import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, List, Divider, useTheme } from 'react-native-paper';
import { getOrders, updateOrderStatus } from '../../api/orders';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'> & {
  /**
   * When rendered inside SplitView (tablet+), the wrapper passes the
   * currently-selected order id directly. This sidesteps the need for
   * a real navigation route + params on the side pane, while still
   * letting the same component work as a full-screen detail on phones.
   */
  orderIdOverride?: string;
};

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  pending: 'Начать приготовление',
  preparing: 'Отметить готовым',
  ready: 'Завершить заказ',
};

export default function OrderDetailScreen({ route, navigation, orderIdOverride }: Props) {
  // `route` is undefined when this component is rendered as a child of
  // SplitView rather than a real Stack.Screen — guard accordingly.
  const orderId = orderIdOverride ?? route?.params?.orderId;
  const theme = useTheme();
  const toast = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const orders = await getOrders();
      const found = orders.find((o: any) => o.id === orderId);
      setOrder(found || null);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusUpdate = async () => {
    if (!order) return;
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;

    setUpdating(true);
    try {
      const updated = await updateOrderStatus(order.id, nextStatus);
      setOrder(updated);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось обновить статус');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Заказ не найден</Text>
      </View>
    );
  }

  const nextStatus = NEXT_STATUS[order.status];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.row}>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
              Заказ #{order.orderNumber}
            </Text>
            <StatusBadge status={order.status} domain="order" />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Стол</Text>
            <Text variant="bodyMedium">{order.tableNumber}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Официант</Text>
            <Text variant="bodyMedium">{order.waiterName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Время</Text>
            <Text variant="bodyMedium">
              {new Date(order.createdAt).toLocaleString('ru-RU')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Оплата</Text>
            <Text variant="bodyMedium">
              {order.paymentStatus === 'paid' ? 'Оплачено' : order.paymentStatus === 'charged-to-folio' ? 'На фолио' : 'Не оплачено'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Позиции заказа
      </Text>

      <FlatList
        data={order.items || []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={`${item.menuItemName} x${item.quantity}`}
            description={item.notes || undefined}
            right={() => (
              <Text variant="bodyMedium" style={{ alignSelf: 'center' }}>
                {(Number(item.menuItemPrice) * item.quantity).toFixed(2)} TJS
              </Text>
            )}
            style={styles.listItem}
          />
        )}
        contentContainerStyle={styles.itemsList}
      />

      <Card style={styles.totalCard}>
        <Card.Content style={styles.totalRow}>
          <Text variant="titleMedium">Итого</Text>
          <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {Number(order.total).toFixed(2)} TJS
          </Text>
        </Card.Content>
      </Card>

      {nextStatus && (
        <Button
          mode="contained"
          onPress={handleStatusUpdate}
          loading={updating}
          disabled={updating}
          style={styles.actionButton}
        >
          {NEXT_STATUS_LABEL[order.status] || 'Обновить'}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  infoCard: { margin: 12, borderRadius: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: { marginVertical: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { opacity: 0.6 },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    fontWeight: 'bold',
  },
  itemsList: { paddingHorizontal: 4 },
  listItem: { paddingVertical: 2 },
  totalCard: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    margin: 12,
    borderRadius: 8,
  },
});
