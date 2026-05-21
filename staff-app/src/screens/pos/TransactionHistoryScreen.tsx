import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import { getTransactions } from '../../api/pos';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { POSStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';

type Props = NativeStackScreenProps<POSStackParamList, 'TransactionHistory'>;

const TYPE_FILTERS = [
  { key: undefined, label: 'Все' },
  { key: 'shop', label: 'Магазин' },
  { key: 'bar', label: 'Бар' },
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  mobile: 'QR',
};

export default function TransactionHistoryScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactions(activeFilter);
      setTransactions(data);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTransactions();
    });
    return unsubscribe;
  }, [navigation, fetchTransactions]);

  const renderTransaction = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
            #{item.id.slice(0, 8)}
          </Text>
          <StatusBadge status={item.status || 'completed'} domain="transaction" />
        </View>

        <View style={styles.row}>
          <Text variant="bodyMedium" style={styles.label}>Сотрудник:</Text>
          <Text variant="bodyMedium">{item.employee}</Text>
        </View>

        <View style={styles.row}>
          <Text variant="bodyMedium" style={styles.label}>Тип:</Text>
          <Text variant="bodyMedium">{item.type}</Text>
        </View>

        <View style={styles.row}>
          <Text variant="bodyMedium" style={styles.label}>Оплата:</Text>
          <Text variant="bodyMedium">
            {PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod}
          </Text>
        </View>

        <View style={styles.row}>
          <Text variant="bodyMedium" style={styles.label}>Сумма:</Text>
          <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {Number(item.total).toFixed(2)} TJS
          </Text>
        </View>

        {/* Items summary */}
        {item.items && item.items.length > 0 && (
          <View style={styles.itemsSummary}>
            <Text variant="bodySmall" style={{ opacity: 0.5 }}>
              {item.items.map((i: any) => `${i.name} x${i.quantity}`).join(', ')}
            </Text>
          </View>
        )}

        <Text variant="bodySmall" style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleString('ru-RU')}
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((filter) => (
          <Chip
            key={filter.label}
            selected={activeFilter === filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={styles.filterChip}
            compact
          >
            {filter.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchTransactions} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="history" title="Нет транзакций" />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: { marginBottom: 4 },
  list: { padding: 12, paddingBottom: 20 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: { opacity: 0.6, marginRight: 4, minWidth: 90 },
  itemsSummary: { marginTop: 6 },
  timestamp: { opacity: 0.4, marginTop: 6 },
});
