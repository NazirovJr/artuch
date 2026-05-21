import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  List,
  Searchbar,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  WarehouseItem,
  getWarehouseItems,
} from '../../api/warehouse-items';
import { Warehouse, getWarehouses } from '../../api/warehouses';
import { createTransfer } from '../../api/transfers';
import { QueuedError } from '../../api/outbox';
import { useAuthStore } from '../../store/authStore';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'NewTransfer'>;

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function NewTransferScreen({ route, navigation }: Props) {
  const initialSource = route.params?.sourceWarehouseId;
  const user = useAuthStore((s) => s.user);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [sourceId, setSourceId] = useState<string | undefined>(initialSource);
  const [targetId, setTargetId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const idempotencyKey = useMemo(() => uuid(), []);

  const load = useCallback(async () => {
    try {
      const [w, i] = await Promise.all([getWarehouses(), getWarehouseItems()]);
      setWarehouses(w.filter((x) => x.isActive));
      setItems(i);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить данные');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sourceItems = useMemo(
    () => items.filter((it) => it.warehouseId === sourceId),
    [items, sourceId],
  );

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? sourceItems.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 12)
      : sourceItems.slice(0, 12);
  }, [sourceItems, search]);

  const qtyValid = Number(quantity) > 0;
  const overshoot =
    selectedItem !== null &&
    qtyValid &&
    Number(quantity) > Number(selectedItem.quantity);

  const canSave =
    !!sourceId &&
    !!targetId &&
    sourceId !== targetId &&
    !!selectedItem &&
    qtyValid &&
    !overshoot &&
    !!user &&
    !saving;

  const handleSave = async () => {
    if (!canSave || !selectedItem || !sourceId || !targetId || !user) return;
    setSaving(true);
    try {
      await createTransfer({
        sourceWarehouseId: sourceId,
        targetWarehouseId: targetId,
        sourceItemId: selectedItem.id,
        quantity: Number(quantity),
        createdBy: user.id,
        notes: notes.trim() || undefined,
        idempotencyKey,
      });
      navigation.goBack();
    } catch (e: any) {
      if (e instanceof QueuedError) {
        Alert.alert(
          'Сохранено офлайн',
          'Перемещение отправится при появлении сети.',
        );
        navigation.goBack();
      } else {
        Alert.alert('Ошибка', e.message || 'Не удалось создать перемещение');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <Text variant="titleMedium" style={styles.label}>Откуда</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {warehouses.map((w) => (
              <Button
                key={w.id}
                mode={sourceId === w.id ? 'contained' : 'outlined'}
                compact
                onPress={() => {
                  setSourceId(w.id);
                  setSelectedItem(null);
                }}
                style={styles.chipBtn}
              >
                {w.name}
              </Button>
            ))}
          </View>
        </ScrollView>

        <Text variant="titleMedium" style={styles.label}>Куда</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {warehouses
              .filter((w) => w.id !== sourceId)
              .map((w) => (
                <Button
                  key={w.id}
                  mode={targetId === w.id ? 'contained' : 'outlined'}
                  compact
                  onPress={() => setTargetId(w.id)}
                  style={styles.chipBtn}
                >
                  {w.name}
                </Button>
              ))}
          </View>
        </ScrollView>

        <Text variant="titleMedium" style={styles.label}>Товар</Text>
        {!sourceId ? (
          <Text variant="bodySmall" style={styles.help}>
            Сначала выберите склад-источник
          </Text>
        ) : selectedItem ? (
          <List.Item
            title={selectedItem.name}
            description={`Доступно: ${selectedItem.quantity} ${selectedItem.unit}`}
            left={(props) => <List.Icon {...props} icon="package-variant" />}
            right={() => (
              <Button compact onPress={() => setSelectedItem(null)}>
                Сменить
              </Button>
            )}
          />
        ) : (
          <>
            <Searchbar
              placeholder="Найти товар"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
            />
            {candidates.map((it) => (
              <List.Item
                key={it.id}
                title={it.name}
                description={`${it.quantity} ${it.unit}`}
                onPress={() => setSelectedItem(it)}
              />
            ))}
            {candidates.length === 0 && (
              <Text variant="bodySmall" style={styles.help}>
                На источнике нет товаров
              </Text>
            )}
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
          error={overshoot}
        />
        {overshoot && (
          <HelperText type="error" visible>
            Больше доступного остатка
          </HelperText>
        )}

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
          Создать перемещение
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 64, gap: 4 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chipBtn: { marginRight: 4 },
  search: { marginBottom: 8 },
  help: { opacity: 0.6, paddingVertical: 8 },
  submit: { marginTop: 24 },
});
