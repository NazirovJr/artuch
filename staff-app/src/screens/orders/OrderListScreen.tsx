import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, Chip, FAB, useTheme } from 'react-native-paper';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useOrderStore } from '../../store/orderStore';
import { getOrders } from '../../api/orders';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { useToast } from '../../components/ui/Toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderList'> & {
  /**
   * Master-detail mode (tablet+ via OrdersScreen wrapper). When set, taps
   * call this callback instead of pushing OrderDetail onto the stack —
   * the wrapper renders the detail in a side pane. When omitted, falls
   * back to navigation as before. `selectedOrderId` lets us highlight
   * the active row in the list.
   */
  onSelectOrder?: (orderId: string) => void;
  selectedOrderId?: string | null;
};

const STATUS_FILTERS = [
  { key: undefined, label: 'Все' },
  { key: 'pending', label: 'Ожидает' },
  { key: 'preparing', label: 'Готовится' },
  { key: 'ready', label: 'Готов' },
  { key: 'completed', label: 'Завершён' },
] as const;

export default function OrderListScreen({ navigation, onSelectOrder, selectedOrderId }: Props) {
  const { orders, loading, setOrders, setLoading } = useOrderStore();
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [initialLoad, setInitialLoad] = useState(true);
  const theme = useTheme();
  const toast = useToast();

  const openOrder = useCallback(
    (orderId: string) => {
      if (onSelectOrder) onSelectOrder(orderId);
      else navigation.navigate('OrderDetail', { orderId });
    },
    [onSelectOrder, navigation],
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders(activeFilter);
      setOrders(data);
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить заказы', 'error');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [activeFilter, setOrders, setLoading, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchOrders();
    });
    return unsubscribe;
  }, [navigation, fetchOrders]);

  const renderOrder = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Card
        style={[
          styles.card,
          selectedOrderId === item.id && {
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        onPress={() => openOrder(item.id)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.orderNumber}>
              #{item.orderNumber}
            </Text>
            <StatusBadge status={item.status} domain="order" />
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.outline }]}>Стол:</Text>
            <Text variant="bodyMedium">{item.tableNumber}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.outline }]}>Официант:</Text>
            <Text variant="bodyMedium">{item.waiterName}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.outline }]}>Сумма:</Text>
            <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
              {Number(item.total).toFixed(2)} TJS
            </Text>
          </View>

          <Text variant="bodySmall" style={[styles.timestamp, { color: theme.colors.outline }]}>
            {new Date(item.createdAt).toLocaleString('ru-RU')}
          </Text>
        </Card.Content>
      </Card>
    </Animated.View>
  );

  if (initialLoad && loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LoadingSkeleton count={5} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
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
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchOrders} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="clipboard-text-off"
              title="Нет заказов"
              subtitle="Заказы появятся здесь после создания"
              actionLabel="Создать заказ"
              onAction={() => navigation.navigate('NewOrder')}
            />
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('NewOrder')}
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
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: { fontWeight: 'bold' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: { marginRight: 4 },
  timestamp: { marginTop: 6 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
  },
});
