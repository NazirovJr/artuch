import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  Menu,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { getExpenseCategories, EXPENSE_GROUPS } from '../../api/expenses';
import { getIncomeCategories, INCOME_GROUPS } from '../../api/incomes';
import { getOutlets, type Outlet } from '../../api/outlets';

/** The filter values this sheet edits. All optional; empty = no filter. */
export interface FinanceFilterValues {
  categoryId?: string;
  group?: string;
  paymentMethod?: string;
  outletId?: string;
  status?: string;
  q?: string;
}

type Kind = 'expense' | 'income' | 'finance';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  value: FinanceFilterValues;
  onApply: (v: FinanceFilterValues) => void;
  /** Which directory powers category/group options + which fields show. */
  kind: Kind;
}

interface Opt {
  value: string;
  label: string;
}

const PAYMENT_BY_KIND: Record<Kind, Opt[]> = {
  expense: [
    { value: 'cash', label: 'Наличные' },
    { value: 'card', label: 'Карта' },
    { value: 'bank', label: 'Банк' },
    { value: 'other', label: 'Прочее' },
  ],
  income: [
    { value: 'cash', label: 'Наличные' },
    { value: 'card', label: 'Карта' },
    { value: 'bank', label: 'Банк' },
    { value: 'other', label: 'Прочее' },
  ],
  finance: [
    { value: 'cash', label: 'Наличные' },
    { value: 'card', label: 'Карта' },
    { value: 'folio', label: 'На номер (фолио)' },
  ],
};

/** Single-select dropdown row with an "Все" reset option. */
function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: Opt[];
  onChange: (v?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? 'Все';
  return (
    <View style={styles.field}>
      <Text variant="labelMedium" style={styles.fieldLabel}>
        {label}
      </Text>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button mode="outlined" icon="menu-down" contentStyle={styles.selectBtn} onPress={() => setOpen(true)}>
            {current}
          </Button>
        }
      >
        <Menu.Item
          title="Все"
          onPress={() => {
            onChange(undefined);
            setOpen(false);
          }}
        />
        <Divider />
        {options.map((o) => (
          <Menu.Item
            key={o.value}
            title={o.label}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
          />
        ))}
      </Menu>
    </View>
  );
}

export default function FinanceFilters({ visible, onDismiss, value, onApply, kind }: Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState<FinanceFilterValues>(value);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [outlets, setOutlets] = useState<Opt[]>([]);

  const groups: Opt[] = kind === 'income' ? INCOME_GROUPS : EXPENSE_GROUPS;
  const showCategory = kind !== 'finance';
  const showGroup = kind !== 'finance';
  const showStatus = kind !== 'finance';
  const showSearch = kind !== 'finance';

  // Re-seed the draft each time the sheet opens so it reflects applied state.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  // Load option sources lazily on first open.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      try {
        const [outletsData, cats] = await Promise.all([
          getOutlets(),
          showCategory
            ? kind === 'income'
              ? getIncomeCategories(true)
              : getExpenseCategories(true)
            : Promise.resolve([]),
        ]);
        if (!alive) return;
        setOutlets(outletsData.map((o: Outlet) => ({ value: o.id, label: o.name })));
        setCategories((cats as any[]).map((c) => ({ value: c.id, label: c.name })));
      } catch {
        // Non-fatal — selects just stay empty.
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, kind, showCategory]);

  const set = (patch: Partial<FinanceFilterValues>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium" style={styles.title}>
          Фильтры
        </Text>
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {showCategory && (
            <SelectRow
              label="Категория"
              value={draft.categoryId}
              options={categories}
              onChange={(v) => set({ categoryId: v })}
            />
          )}
          {showGroup && (
            <SelectRow
              label="Группа"
              value={draft.group}
              options={groups}
              onChange={(v) => set({ group: v })}
            />
          )}
          <SelectRow
            label="Способ оплаты"
            value={draft.paymentMethod}
            options={PAYMENT_BY_KIND[kind]}
            onChange={(v) => set({ paymentMethod: v })}
          />
          <SelectRow
            label="Точка"
            value={draft.outletId}
            options={outlets}
            onChange={(v) => set({ outletId: v })}
          />
          {showStatus && (
            <View style={styles.field}>
              <Text variant="labelMedium" style={styles.fieldLabel}>
                Статус
              </Text>
              <SegmentedButtons
                value={draft.status ?? 'all'}
                onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}
                density="small"
                buttons={[
                  { value: 'all', label: 'Все' },
                  { value: 'recorded', label: 'Проведён' },
                  { value: 'void', label: 'Отменён' },
                ]}
              />
            </View>
          )}
          {showSearch && (
            <View style={styles.field}>
              <Text variant="labelMedium" style={styles.fieldLabel}>
                Поиск
              </Text>
              <TextInput
                mode="outlined"
                dense
                placeholder="Плательщик, описание…"
                value={draft.q ?? ''}
                onChangeText={(t) => set({ q: t || undefined })}
              />
            </View>
          )}
        </ScrollView>
        <View style={styles.actions}>
          <Button mode="text" onPress={() => setDraft({})}>
            Сбросить
          </Button>
          <Button
            mode="contained"
            onPress={() => {
              onApply(draft);
              onDismiss();
            }}
          >
            Применить
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

/** Count of active (non-empty) filters — for a badge on the trigger button. */
export function countActiveFilters(v: FinanceFilterValues): number {
  return [v.categoryId, v.group, v.paymentMethod, v.outletId, v.status, v.q].filter(
    Boolean,
  ).length;
}

const styles = StyleSheet.create({
  modal: { margin: 20, borderRadius: 16, padding: 16, maxHeight: '85%' },
  title: { fontWeight: '700', marginBottom: 8 },
  body: { flexGrow: 0 },
  field: { marginBottom: 14 },
  fieldLabel: { opacity: 0.7, marginBottom: 4 },
  selectBtn: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
