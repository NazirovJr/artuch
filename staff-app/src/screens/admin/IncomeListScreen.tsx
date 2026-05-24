import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import {
  Text,
  List,
  FAB,
  Card,
  SegmentedButtons,
  Button,
  Badge,
  IconButton,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import {
  getIncomes,
  getIncomeSummary,
  voidIncome,
  exportIncomesXlsx,
  INCOME_PAYMENT_METHOD_LABELS,
  type Income,
  type IncomeSummary,
  type IncomeQuery,
} from '../../api/incomes';
import FinanceFilters, {
  countActiveFilters,
  type FinanceFilterValues,
} from '../../components/finance/FinanceFilters';
import { useToast } from '../../components/ui/Toast';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'IncomeList'>;

const PERIODS = [
  { value: '7', label: '7 дн' },
  { value: '30', label: '30 дн' },
  { value: 'month', label: 'Месяц' },
];

function computeRange(key: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate =
    key === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getTime() - Number(key) * 86_400_000);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} TJS`;

export default function IncomeListScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [period, setPeriod] = useState('30');
  const [filters, setFilters] = useState<FinanceFilterValues>({});
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => computeRange(period), [period]);
  const query: IncomeQuery = useMemo(
    () => ({ from: range.from, to: range.to, ...filters }),
    [range, filters],
  );
  const activeFilterCount = countActiveFilters(filters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        getIncomes(query),
        getIncomeSummary(query),
      ]);
      setIncomes(list);
      setSummary(sum);
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить доходы', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportIncomesXlsx(query);
      toast.show('XLSX готов', 'success');
    } catch (e: any) {
      toast.show(e.message || 'Не удалось выгрузить', 'error');
    } finally {
      setExporting(false);
    }
  }, [query, toast]);

  const confirmVoid = (income: Income) => {
    Alert.alert(
      'Отменить доход?',
      `${income.categoryName} · ${money(income.amount)}`,
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Отменить доход',
          style: 'destructive',
          onPress: async () => {
            try {
              await voidIncome(income.id);
              toast.show('Доход отменён', 'success');
              fetchData();
            } catch (e: any) {
              toast.show(e.message || 'Не удалось отменить', 'error');
            }
          },
        },
      ],
    );
  };

  if (loading && incomes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LoadingSkeleton count={6} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.controls}>
        <SegmentedButtons value={period} onValueChange={setPeriod} buttons={PERIODS} density="small" />
        <View style={styles.actionRow}>
          <View style={styles.filterWrap}>
            <Button mode="outlined" icon="filter-variant" onPress={() => setFiltersVisible(true)} style={styles.actionBtn}>
              Фильтры
            </Button>
            {activeFilterCount > 0 && <Badge style={styles.badge}>{activeFilterCount}</Badge>}
          </View>
          <Button
            mode="contained-tonal"
            icon="file-excel"
            loading={exporting}
            disabled={exporting}
            onPress={handleExport}
            style={styles.actionBtn}
          >
            XLSX
          </Button>
        </View>
      </View>

      <Card style={[styles.totalCard, { backgroundColor: theme.colors.primary }]}>
        <Card.Content>
          <Text variant="labelLarge" style={{ color: theme.colors.onPrimary, opacity: 0.85 }}>
            Прочие доходы за период
          </Text>
          <Text variant="headlineMedium" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
            {money(summary?.total ?? 0)}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onPrimary, opacity: 0.85 }}>
            {summary?.count ?? 0} записей
          </Text>
        </Card.Content>
      </Card>

      <FlatList
        data={incomes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isVoid = item.status === 'void';
          const sub = `${item.receivedAt} · ${INCOME_PAYMENT_METHOD_LABELS[item.paymentMethod] || item.paymentMethod}${
            item.payer ? ` · ${item.payer}` : ''
          }`;
          return (
            <List.Item
              title={item.categoryName}
              description={sub}
              titleStyle={isVoid ? styles.voidText : undefined}
              right={() => (
                <View style={styles.rightCol}>
                  <Text variant="titleSmall" style={[styles.amount, isVoid && styles.voidText]}>
                    {money(item.amount)}
                  </Text>
                  {isVoid ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                      отменён
                    </Text>
                  ) : (
                    <IconButton
                      icon="close-circle-outline"
                      size={20}
                      onPress={() => confirmVoid(item)}
                      style={styles.voidBtn}
                    />
                  )}
                </View>
              )}
            />
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : (
            <Text style={styles.empty}>За период доходов нет</Text>
          )
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
      />

      <FAB
        icon="plus"
        label="Доход"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('IncomeForm')}
      />

      <FinanceFilters
        visible={filtersVisible}
        onDismiss={() => setFiltersVisible(false)}
        value={filters}
        onApply={setFilters}
        kind="income"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { padding: 12, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  filterWrap: { flex: 1 },
  actionBtn: { flex: 1, borderRadius: 8 },
  badge: { position: 'absolute', top: -6, right: -6 },
  totalCard: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12 },
  list: { paddingBottom: 96 },
  rightCol: { alignItems: 'flex-end', justifyContent: 'center' },
  amount: { fontWeight: '700' },
  voidBtn: { margin: 0 },
  voidText: { textDecorationLine: 'line-through', opacity: 0.5 },
  empty: { textAlign: 'center', marginTop: 32, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 28 },
});
