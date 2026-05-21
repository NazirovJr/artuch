import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  List,
  SegmentedButtons,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  WarehouseItem,
  WarehouseTransactionType,
  createWarehouseTransaction,
  getWarehouseItems,
} from '../../api/warehouse-items';
import { Supplier, getSuppliers } from '../../api/suppliers';
import { QueuedError } from '../../api/outbox';
import { useAuthStore } from '../../store/authStore';
import type { WarehouseStackParamList } from '../../navigation/types';
import {
  maskDate,
  moneyInputFilter,
  maskMoney,
  unmaskMoney as unmaskMoneyValue,
} from '../../utils/inputMask';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'ReceiveStock'>;

const TYPE_OPTIONS: {
  value: WarehouseTransactionType;
  label: string;
  description: string;
}[] = [
  { value: 'income', label: 'Приход', description: 'Поступление от поставщика' },
  { value: 'expense', label: 'Расход', description: 'Выдача / списание' },
  { value: 'writeoff', label: 'Списание', description: 'Брак / просрочка' },
  {
    value: 'return_customer',
    label: 'Возврат клиента',
    description: 'Возврат от клиента (товар обратно на склад)',
  },
  {
    value: 'return_supplier',
    label: 'Возврат поставщику',
    description: 'Возврат поставщику (товар уходит со склада)',
  },
];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ReceiveStockScreen({ route, navigation }: Props) {
  const { warehouseId, itemId, mode } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [type, setType] = useState<WarehouseTransactionType>(
    (mode === 'expense' ? 'expense' : 'income') as WarehouseTransactionType,
  );
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [recipient, setRecipient] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // P2.1 / P2.2 — optional fields
  const [lotCode, setLotCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(''); // ISO YYYY-MM-DD
  const [unitCost, setUnitCost] = useState('');
  const [inputUnit, setInputUnit] = useState('');

  // Supplier directory + picker state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );

  // Idempotency key generated once on mount — survives form re-renders so
  // a tap that times out and is retried by the user maps to the same UUID.
  const idempotencyKey = useMemo(() => uuid(), []);

  const load = useCallback(async () => {
    try {
      const [all, supps] = await Promise.all([
        getWarehouseItems(),
        getSuppliers().catch(() => []),
      ]);
      const filtered = all.filter((i) => i.warehouseId === warehouseId);
      setItems(filtered);
      setSuppliers(supps);
      if (itemId) {
        const found = filtered.find((i) => i.id === itemId);
        if (found) setSelectedItem(found);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить товары');
    }
  }, [warehouseId, itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const candidates = useMemo(() => {
    if (!search.trim()) return items.slice(0, 12);
    const q = search.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 12);
  }, [items, search]);

  const qtyValid = Number(quantity) > 0;
  const isDecrement =
    type === 'expense' || type === 'writeoff' || type === 'return_supplier';
  const isReceipt = type === 'income' || type === 'return_customer';
  // Negative-stock guard only applies to canonical-unit input. If user
  // enters in a different unit, server converts and validates — we skip
  // client-side check to avoid false positives.
  const wouldGoNegative =
    isDecrement &&
    !inputUnit &&
    selectedItem !== null &&
    qtyValid &&
    Number(selectedItem.quantity) - Number(quantity) < 0;

  const canSave =
    !!selectedItem && qtyValid && !wouldGoNegative && !saving && !!user;

  const handleSave = async () => {
    if (!canSave || !selectedItem || !user) return;
    setSaving(true);
    try {
      // Prefer the FK supplier when picked; the free-text field stays
      // available for one-off vendors not yet in the directory.
      const supplierName = isReceipt
        ? selectedSupplier?.name ?? supplier.trim() ?? undefined
        : undefined;
      await createWarehouseTransaction({
        type,
        itemId: selectedItem.id,
        quantity: Number(quantity),
        performedBy: user.id,
        supplier: supplierName || undefined,
        supplierId: isReceipt ? selectedSupplier?.id : undefined,
        recipient: isDecrement ? recipient.trim() || undefined : undefined,
        totalCost: totalCost ? Number(unmaskMoneyValue(totalCost)) : undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
        // Lot fields are only meaningful on receipts.
        lotCode: isReceipt ? lotCode.trim() || undefined : undefined,
        expiresAt: isReceipt ? expiresAt.trim() || undefined : undefined,
        unitCost:
          isReceipt && unitCost ? Number(unmaskMoneyValue(unitCost)) : undefined,
        inputUnit: inputUnit.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      if (e instanceof QueuedError) {
        // Soft-success: server unreachable, request queued. Tell the
        // user and pop the screen so they can keep working.
        Alert.alert(
          'Сохранено офлайн',
          'Операция отправится при появлении сети.',
        );
        navigation.goBack();
      } else {
        Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <Text variant="titleMedium" style={styles.label}>Тип операции</Text>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as WarehouseTransactionType)}
          buttons={TYPE_OPTIONS.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
          style={styles.segmented}
        />
        <HelperText type="info" style={styles.helper}>
          {TYPE_OPTIONS.find((t) => t.value === type)?.description}
        </HelperText>

        <Text variant="titleMedium" style={styles.label}>Товар</Text>
        {selectedItem ? (
          <List.Item
            title={selectedItem.name}
            description={`Текущий остаток: ${selectedItem.quantity} ${selectedItem.unit}`}
            left={(props) => <List.Icon {...props} icon="package-variant" />}
            right={(props) => (
              <Button
                {...props}
                compact
                onPress={() => {
                  setSelectedItem(null);
                  setSearch('');
                }}
              >
                Сменить
              </Button>
            )}
            style={[styles.selectedItem, { borderColor: theme.colors.outline }]}
          />
        ) : (
          <>
            <Searchbar
              placeholder="Найти товар на складе"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
            />
            <View style={styles.candidates}>
              {candidates.map((it) => (
                <List.Item
                  key={it.id}
                  title={it.name}
                  description={`${it.quantity} ${it.unit} • ${it.category}`}
                  onPress={() => setSelectedItem(it)}
                />
              ))}
              {candidates.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text variant="bodySmall" style={styles.empty}>
                    Ничего не найдено
                  </Text>
                  <Button
                    mode="contained-tonal"
                    icon="package-variant-plus"
                    onPress={() =>
                      navigation.navigate('NewWarehouseItem', { warehouseId })
                    }
                    style={styles.createBtn}
                  >
                    Создать новый товар
                  </Button>
                </View>
              )}
            </View>
          </>
        )}

        <Text variant="titleMedium" style={styles.label}>Количество</Text>
        <TextInput
          mode="outlined"
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          right={
            selectedItem ? <TextInput.Affix text={selectedItem.unit} /> : null
          }
          error={wouldGoNegative}
        />
        {wouldGoNegative && (
          <HelperText type="error" visible>
            Не хватает остатка: {selectedItem?.quantity} {selectedItem?.unit}
          </HelperText>
        )}

        {isReceipt && (
          <>
            <Text variant="titleMedium" style={styles.label}>Поставщик</Text>
            {suppliers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.supplierRow}>
                  {suppliers.slice(0, 12).map((s) => (
                    <Button
                      key={s.id}
                      compact
                      mode={
                        selectedSupplier?.id === s.id ? 'contained' : 'outlined'
                      }
                      onPress={() => {
                        if (selectedSupplier?.id === s.id) {
                          setSelectedSupplier(null);
                        } else {
                          setSelectedSupplier(s);
                          setSupplier('');
                        }
                      }}
                      style={styles.chipBtn}
                    >
                      {s.name}
                    </Button>
                  ))}
                </View>
              </ScrollView>
            )}
            <TextInput
              mode="outlined"
              value={selectedSupplier?.name ?? supplier}
              onChangeText={(v) => {
                setSupplier(v);
                if (selectedSupplier) setSelectedSupplier(null);
              }}
              placeholder={
                suppliers.length === 0
                  ? 'ООО Поставщик'
                  : 'Или введите вручную'
              }
              disabled={!!selectedSupplier}
            />

            <Text variant="titleMedium" style={styles.label}>
              Серия / партия (опц.)
            </Text>
            <TextInput
              mode="outlined"
              value={lotCode}
              onChangeText={setLotCode}
              placeholder="Lot/Batch с этикетки"
            />

            <Text variant="titleMedium" style={styles.label}>
              Годен до (опц., YYYY-MM-DD)
            </Text>
            <TextInput
              mode="outlined"
              value={expiresAt}
              onChangeText={(v) => setExpiresAt(maskDate(v))}
              placeholder="2026-12-31"
              keyboardType="number-pad"
              autoCapitalize="none"
              maxLength={10}
            />
            <HelperText type="info" visible style={styles.helper}>
              Если указано — товар попадёт в FEFO-список и будет
              отображаться в отчёте "просрочки".
            </HelperText>

            <Text variant="titleMedium" style={styles.label}>
              Себестоимость единицы (опц.)
            </Text>
            <TextInput
              mode="outlined"
              keyboardType="decimal-pad"
              value={unitCost}
              onChangeText={(v) => setUnitCost(moneyInputFilter(v))}
              onBlur={() => unitCost && setUnitCost(maskMoney(unitCost))}
              onFocus={() => setUnitCost(unmaskMoneyValue(unitCost))}
              placeholder="0"
              right={
                selectedItem ? (
                  <TextInput.Affix text={`/${selectedItem.unit}`} />
                ) : null
              }
            />

            <Text variant="titleMedium" style={styles.label}>
              Сумма поставки (опц.)
            </Text>
            <TextInput
              mode="outlined"
              keyboardType="decimal-pad"
              value={totalCost}
              onChangeText={(v) => setTotalCost(moneyInputFilter(v))}
              onBlur={() => totalCost && setTotalCost(maskMoney(totalCost))}
              onFocus={() => setTotalCost(unmaskMoneyValue(totalCost))}
              placeholder="0"
            />
          </>
        )}

        {isDecrement && (
          <>
            <Text variant="titleMedium" style={styles.label}>
              {type === 'expense'
                ? 'Получатель'
                : type === 'return_supplier'
                  ? 'Поставщик'
                  : 'Причина списания'}
            </Text>
            <TextInput
              mode="outlined"
              value={recipient}
              onChangeText={setRecipient}
              placeholder={
                type === 'expense'
                  ? 'Куда передано'
                  : type === 'return_supplier'
                    ? 'Кому возвращаем'
                    : 'Брак / просрочка / порча'
              }
            />
          </>
        )}

        <Text variant="titleMedium" style={styles.label}>
          Единица ввода (опц.)
        </Text>
        <TextInput
          mode="outlined"
          value={inputUnit}
          onChangeText={setInputUnit}
          placeholder={
            selectedItem
              ? `по умолчанию: ${selectedItem.unit}`
              : 'box, bottle, ml...'
          }
          autoCapitalize="none"
        />
        <HelperText type="info" visible style={styles.helper}>
          Если отличается от канонической, должна быть настроена конвертация
          для этого товара.
        </HelperText>

        <Text variant="titleMedium" style={styles.label}>Примечание</Text>
        <TextInput
          mode="outlined"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
          style={styles.submit}
        >
          Сохранить операцию
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 64, gap: 4 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  segmented: { marginBottom: 4 },
  helper: { marginBottom: 8 },
  search: { marginBottom: 8 },
  selectedItem: { borderWidth: 1, borderRadius: 8, marginBottom: 4 },
  candidates: { marginBottom: 8 },
  empty: { textAlign: 'center', paddingVertical: 8, opacity: 0.6 },
  emptyBox: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  createBtn: { marginTop: 4 },
  supplierRow: { flexDirection: 'row', gap: 6, paddingVertical: 4, marginBottom: 6 },
  chipBtn: { marginRight: 4 },
  submit: { marginTop: 24 },
});
