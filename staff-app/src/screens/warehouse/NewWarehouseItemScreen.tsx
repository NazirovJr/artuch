import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  createWarehouseItem,
  getWarehouseCategories,
} from '../../api/warehouse-items';
import { useToast } from '../../components/ui/Toast';
import {
  maskMoney,
  moneyInputFilter,
  unmaskMoney,
} from '../../utils/inputMask';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'NewWarehouseItem'>;

/** Common units pre-filled as quick-pick chips so staff don't need to type. */
const UNIT_PRESETS = ['кг', 'г', 'л', 'мл', 'шт', 'упак', 'м'];

export default function NewWarehouseItemScreen({ route, navigation }: Props) {
  const { warehouseId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const [categories, setCategories] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [initialQty, setInitialQty] = useState('');
  const [price, setPrice] = useState('');
  const [minQty, setMinQty] = useState('');
  const [parLevel, setParLevel] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [barcode, setBarcode] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const list = await getWarehouseCategories();
      setCategories(list);
    } catch {
      // Non-fatal: autocomplete is a convenience, not a requirement.
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Filter category suggestions against the partial input so a few
  // matching chips appear under the field as the user types.
  const categorySuggestions = useMemo(() => {
    const q = category.trim().toLowerCase();
    if (!q) return categories.slice(0, 6);
    return categories.filter((c) => c.toLowerCase().includes(q)).slice(0, 6);
  }, [categories, category]);

  const isNewCategory =
    category.trim().length > 0 &&
    !categories.some(
      (c) => c.toLowerCase() === category.trim().toLowerCase(),
    );

  const canSave =
    !saving &&
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    unit.trim().length > 0 &&
    price.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert(
        'Заполните обязательные поля',
        'Название, тип товара, единица измерения и цена обязательны',
      );
      return;
    }
    setSaving(true);
    try {
      const created = await createWarehouseItem({
        name: name.trim(),
        category: category.trim().toLowerCase(),
        unit: unit.trim(),
        price: parseFloat(unmaskMoney(price)) || 0,
        quantity: initialQty
          ? parseFloat(unmaskMoney(initialQty)) || 0
          : 0,
        minQuantity: minQty
          ? parseFloat(unmaskMoney(minQty)) || 0
          : undefined,
        parLevel: parLevel
          ? parseFloat(unmaskMoney(parLevel)) || 0
          : undefined,
        reorderPoint: reorderPoint
          ? parseFloat(unmaskMoney(reorderPoint)) || 0
          : undefined,
        barcode: barcode.trim() || undefined,
        warehouseId,
      });
      toast.show(`Товар "${created.name}" создан`, 'success');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать товар');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <Text variant="titleMedium" style={styles.section}>
          Основное
        </Text>
        <TextInput
          mode="outlined"
          label="Название *"
          value={name}
          onChangeText={setName}
          placeholder="Например, Свинина"
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label="Тип товара *"
          value={category}
          onChangeText={setCategory}
          placeholder="products, beverages…"
          autoCapitalize="none"
          style={styles.input}
        />
        {categorySuggestions.length > 0 && (
          <View style={styles.chipRow}>
            {categorySuggestions.map((c) => (
              <Chip
                key={c}
                compact
                mode={
                  category.trim().toLowerCase() === c ? 'flat' : 'outlined'
                }
                onPress={() => setCategory(c)}
                style={styles.chip}
              >
                {c}
              </Chip>
            ))}
          </View>
        )}
        {isNewCategory && (
          <HelperText type="info" visible style={styles.helper}>
            Будет создан новый тип «{category.trim().toLowerCase()}»
          </HelperText>
        )}

        <TextInput
          mode="outlined"
          label="Единица измерения *"
          value={unit}
          onChangeText={setUnit}
          placeholder="кг, шт, л…"
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.chipRow}>
          {UNIT_PRESETS.map((u) => (
            <Chip
              key={u}
              compact
              mode={unit === u ? 'flat' : 'outlined'}
              onPress={() => setUnit(u)}
              style={styles.chip}
            >
              {u}
            </Chip>
          ))}
        </View>

        <Text variant="titleMedium" style={styles.section}>
          Запас и цена
        </Text>
        <TextInput
          mode="outlined"
          label="Начальное количество"
          value={initialQty}
          onChangeText={(v) => setInitialQty(moneyInputFilter(v))}
          onBlur={() => initialQty && setInitialQty(maskMoney(initialQty))}
          onFocus={() => setInitialQty(unmaskMoney(initialQty))}
          keyboardType="decimal-pad"
          placeholder="0"
          right={unit ? <TextInput.Affix text={unit} /> : null}
          style={styles.input}
        />
        <HelperText type="info" visible style={styles.helper}>
          Если &gt; 0 — в журнале появится запись «Поступление: начальный
          остаток».
        </HelperText>

        <TextInput
          mode="outlined"
          label="Цена за единицу *"
          value={price}
          onChangeText={(v) => setPrice(moneyInputFilter(v))}
          onBlur={() => price && setPrice(maskMoney(price))}
          onFocus={() => setPrice(unmaskMoney(price))}
          keyboardType="decimal-pad"
          placeholder="0"
          right={<TextInput.Affix text="TJS" />}
          style={styles.input}
        />

        <Text variant="titleMedium" style={styles.section}>
          Пороги (опц.)
        </Text>
        <TextInput
          mode="outlined"
          label="Минимальный остаток"
          value={minQty}
          onChangeText={(v) => setMinQty(moneyInputFilter(v))}
          onBlur={() => minQty && setMinQty(maskMoney(minQty))}
          onFocus={() => setMinQty(unmaskMoney(minQty))}
          keyboardType="decimal-pad"
          placeholder="0"
          right={unit ? <TextInput.Affix text={unit} /> : null}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="PAR (целевой запас)"
          value={parLevel}
          onChangeText={(v) => setParLevel(moneyInputFilter(v))}
          onBlur={() => parLevel && setParLevel(maskMoney(parLevel))}
          onFocus={() => setParLevel(unmaskMoney(parLevel))}
          keyboardType="decimal-pad"
          placeholder="0"
          right={unit ? <TextInput.Affix text={unit} /> : null}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Точка дозаказа (ROP)"
          value={reorderPoint}
          onChangeText={(v) => setReorderPoint(moneyInputFilter(v))}
          onBlur={() => reorderPoint && setReorderPoint(maskMoney(reorderPoint))}
          onFocus={() => setReorderPoint(unmaskMoney(reorderPoint))}
          keyboardType="decimal-pad"
          placeholder="0"
          right={unit ? <TextInput.Affix text={unit} /> : null}
          style={styles.input}
        />

        <Text variant="titleMedium" style={styles.section}>
          Штрихкод (опц.)
        </Text>
        <TextInput
          mode="outlined"
          label="Штрихкод"
          value={barcode}
          onChangeText={setBarcode}
          autoCapitalize="characters"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
          style={styles.submit}
        >
          Создать товар
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 48 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: 'bold' },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { marginRight: 4, marginBottom: 4 },
  helper: { marginTop: -4, marginBottom: 8 },
  submit: { marginTop: 24 },
});
