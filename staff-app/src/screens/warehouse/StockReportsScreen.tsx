import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import {
  Card,
  Chip,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  COGSReport,
  ValuationRow,
  getCOGS,
  getValuation,
} from '../../api/costing';
import { Warehouse, getWarehouses } from '../../api/warehouses';

type Tab = 'cogs' | 'valuation';
type Window = '7' | '30' | '90' | 'ytd';

const WINDOW_OPTIONS: { value: Window; label: string }[] = [
  { value: '7', label: '7 дн' },
  { value: '30', label: '30 дн' },
  { value: '90', label: '90 дн' },
  { value: 'ytd', label: 'С нач. года' },
];

const TYPE_LABEL: Record<string, string> = {
  issue: 'Расход',
  sale: 'Продажа',
  writeoff: 'Списание',
  transfer_out: 'Перемещение →',
  return_supplier: 'Возврат поставщику',
};

function windowToDate(window: Window): Date {
  const now = new Date();
  if (window === 'ytd') return new Date(now.getFullYear(), 0, 1);
  const days = Number(window);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function fmt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, (m) => (m === '.00' ? '' : m));
}

export default function StockReportsScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('cogs');
  const [window, setWindow] = useState<Window>('30');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | undefined>();

  const [cogs, setCogs] = useState<COGSReport | null>(null);
  const [valuation, setValuation] = useState<ValuationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWarehouses = useCallback(async () => {
    try {
      const data = await getWarehouses();
      setWarehouses(data.filter((w) => w.isActive));
    } catch {
      /* non-blocking */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (tab === 'cogs') {
        const data = await getCOGS({
          locationId: warehouseId,
          from: windowToDate(window).toISOString(),
          to: new Date().toISOString(),
        });
        setCogs(data);
      } else {
        const data = await getValuation({ locationId: warehouseId });
        setValuation(data);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  }, [tab, window, warehouseId]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      cogs: cogs ? cogs.totalCost : 0,
      cogsQty: cogs ? cogs.totalQuantity : 0,
      valuation: valuation.reduce((s, r) => s + Number(r.totalValue), 0),
      items: valuation.length,
    }),
    [cogs, valuation],
  );

  const renderValuation = ({ item }: { item: ValuationRow }) => (
    <Card mode="outlined" style={styles.card}>
      <Card.Title
        title={item.itemName}
        subtitle={`${item.totalQuantity} × ${fmt(item.averageUnitCost)}`}
        right={() => (
          <Text variant="titleMedium" style={styles.value}>
            {fmt(item.totalValue)}
          </Text>
        )}
      />
    </Card>
  );

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'cogs', label: 'COGS' },
            { value: 'valuation', label: 'Оценка склада' },
          ]}
        />
        {tab === 'cogs' && (
          <SegmentedButtons
            value={window}
            onValueChange={(v) => setWindow(v as Window)}
            buttons={WINDOW_OPTIONS}
            style={styles.window}
          />
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Chip
              compact
              selected={!warehouseId}
              onPress={() => setWarehouseId(undefined)}
              style={styles.chip}
            >
              Все склады
            </Chip>
            {warehouses.map((w) => (
              <Chip
                key={w.id}
                compact
                selected={warehouseId === w.id}
                onPress={() => setWarehouseId(w.id)}
                style={styles.chip}
              >
                {w.name}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      {tab === 'cogs' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Card mode="outlined" style={styles.summary}>
            <Card.Content>
              <Text variant="labelMedium">COGS за период</Text>
              <Text variant="displaySmall" style={styles.summaryValue}>
                {fmt(totals.cogs)}
              </Text>
              <Text variant="bodySmall">
                Количество: {fmt(totals.cogsQty)}
              </Text>
            </Card.Content>
          </Card>

          {cogs && Object.entries(cogs.byType).length > 0 ? (
            Object.entries(cogs.byType)
              .sort(([, a], [, b]) => b.cost - a.cost)
              .map(([type, agg]) => (
                <Card key={type} mode="outlined" style={styles.card}>
                  <Card.Title
                    title={TYPE_LABEL[type] ?? type}
                    right={() => (
                      <View style={styles.right}>
                        <Text variant="titleMedium">{fmt(agg.cost)}</Text>
                        <Text variant="labelSmall">{fmt(agg.quantity)} ед.</Text>
                      </View>
                    )}
                  />
                </Card>
              ))
          ) : (
            <EmptyState
              icon="chart-line"
              title="Нет движений за период"
            />
          )}
        </ScrollView>
      ) : (
        <>
          <Card mode="outlined" style={[styles.summary, styles.body]}>
            <Card.Content>
              <Text variant="labelMedium">Оценка по FIFO</Text>
              <Text variant="displaySmall" style={styles.summaryValue}>
                {fmt(totals.valuation)}
              </Text>
              <Text variant="bodySmall">
                {totals.items} позиций
              </Text>
            </Card.Content>
          </Card>
          <FlatList
            data={valuation.sort((a, b) => b.totalValue - a.totalValue)}
            keyExtractor={(r) => `${r.source}|${r.itemId}|${r.locationId}`}
            renderItem={renderValuation}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="package-variant-closed"
                title="Нет лотов с указанной себестоимостью"
              />
            }
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, gap: 10 },
  window: {},
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { marginRight: 4 },
  body: { padding: 12 },
  summary: { marginBottom: 12 },
  summaryValue: { fontWeight: '700', marginVertical: 4 },
  card: { marginBottom: 12 },
  right: { alignItems: 'flex-end', paddingRight: 12 },
  value: { fontWeight: '600', paddingRight: 12 },
  list: { paddingHorizontal: 12, paddingBottom: 96 },
});
