import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, SegmentedButtons } from 'react-native-paper';
import { getRevenue } from '../../api/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';
import { semantic } from '../../theme/colors';
import Sparkline from '../../components/charts/Sparkline';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export default function RevenueScreen() {
  const theme = useAppTheme();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('day');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRevenue(period);
      setData(result);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content style={styles.row}>
        <View>
          <Text variant="titleSmall">{formatDate(item.period)}</Text>
          <Text variant="bodySmall" style={styles.count}>
            {item.count} транзакций
          </Text>
        </View>
        <Text variant="titleMedium" style={styles.revenue}>
          {item.revenue.toLocaleString('ru-RU')} TJS
        </Text>
      </Card.Content>
    </Card>
  );

  // API yields newest-first; reverse to render left-to-right in the sparkline.
  const trendValues = useMemo(
    () => [...data].reverse().map((r) => Number(r.revenue) || 0),
    [data],
  );
  const total = useMemo(
    () => data.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0),
    [data],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.segmentContainer}>
        <SegmentedButtons
          value={period}
          onValueChange={setPeriod}
          buttons={[
            { value: 'day', label: 'День' },
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
          ]}
        />
      </View>

      {/* Trend summary card — sits above the detail list so users get the gestalt first. */}
      {data.length > 0 && (
        <View
          style={[
            styles.trendCard,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: borderRadius.lg,
              ...shadows.sm,
            },
          ]}
        >
          <Text variant="labelLarge" style={{ color: theme.colors.onPrimary, opacity: 0.85 }}>
            Общая выручка
          </Text>
          <Text
            variant="displaySmall"
            style={{ color: theme.colors.onPrimary, fontWeight: '700' }}
          >
            {total.toLocaleString('ru-RU')} TJS
          </Text>
          <Sparkline values={trendValues} color={theme.colors.onPrimary} height={72} />
        </View>
      )}

      <FlatList
        data={data}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={{ opacity: 0.5 }}>
                Нет данных
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentContainer: { padding: 12, paddingBottom: 0 },
  list: { padding: 12, paddingBottom: 24 },
  card: { marginBottom: 8, borderRadius: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: { opacity: 0.5, marginTop: 2 },
  revenue: { fontWeight: 'bold', color: semantic.success },
  trendCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
