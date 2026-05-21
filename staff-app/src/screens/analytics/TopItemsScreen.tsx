import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { getTopItems } from '../../api/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';
import { semantic } from '../../theme/colors';
import BarMini from '../../components/charts/BarMini';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

export default function TopItemsScreen() {
  const theme = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTopItems(10);
      setItems(data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Card style={styles.card}>
      <Card.Content style={styles.row}>
        <View style={styles.rankContainer}>
          <Text variant="titleLarge" style={styles.rank}>
            {index + 1}
          </Text>
        </View>
        <View style={styles.info}>
          <Text variant="titleSmall">{item.name}</Text>
          <Text variant="bodySmall" style={styles.quantity}>
            {item.totalQuantity} шт.
          </Text>
        </View>
        <Text variant="titleSmall" style={styles.revenue}>
          {item.totalRevenue.toLocaleString('ru-RU')} TJS
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {items.length > 0 && (
        <View
          style={[
            styles.preview,
            { backgroundColor: theme.colors.surface, borderRadius: borderRadius.lg, ...shadows.sm },
          ]}
        >
          <Text variant="titleMedium" style={[styles.previewTitle, { color: theme.colors.onSurface }]}>
            Распределение продаж
          </Text>
          <BarMini
            data={items.slice(0, 5).map((i) => ({ label: i.name, value: Number(i.totalQuantity) || 0 }))}
            color={theme.colors.primary}
            limit={5}
            formatValue={(v) => `${v}×`}
          />
        </View>
      )}
      <FlatList
        data={items}
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
  list: { padding: 12, paddingBottom: 24 },
  card: { marginBottom: 8, borderRadius: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: semantic.info,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rank: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  info: { flex: 1 },
  quantity: { opacity: 0.5, marginTop: 2 },
  revenue: { fontWeight: 'bold', color: semantic.success },
  preview: {
    margin: spacing.md,
    padding: spacing.lg,
  },
  previewTitle: {
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
