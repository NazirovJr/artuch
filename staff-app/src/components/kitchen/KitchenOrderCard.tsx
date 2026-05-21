import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import TimerBadge from './TimerBadge';
import { useAppTheme } from '../../hooks/useAppTheme';
import { semantic } from '../../theme/colors';

interface OrderItem {
  menuItemName: string;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: number;
  tableNumber: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

interface KitchenOrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: string) => void;
}

function KitchenOrderCard({ order, onStatusChange }: KitchenOrderCardProps) {
  const theme = useAppTheme();
  const actionConfig = useMemo<Record<string, { label: string; nextStatus: string; color: string }>>(
    () => ({
      pending: { label: 'Начать', nextStatus: 'preparing', color: theme.colors.primary },
      preparing: { label: 'Готово', nextStatus: 'ready', color: semantic.success },
      ready: { label: 'Выдано', nextStatus: 'completed', color: semantic.muted },
    }),
    [theme.colors.primary],
  );
  const action = actionConfig[order.status];

  const handlePress = useCallback(() => {
    if (action) {
      onStatusChange(order.id, action.nextStatus);
    }
  }, [order.id, action, onStatusChange]);

  return (
    <Card style={styles.card}>
      <Card.Content>
        {/* Header: order number, table, timer */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleMedium" style={styles.orderNumber}>
              #{order.orderNumber}
            </Text>
            <Text variant="bodyMedium" style={styles.table}>
              Стол {order.tableNumber}
            </Text>
          </View>
          <TimerBadge createdAt={order.createdAt} />
        </View>

        {/* Items list */}
        <View style={styles.itemsList}>
          {order.items.map((item, index) => (
            <Text key={index} variant="bodyMedium" style={styles.itemText}>
              {item.menuItemName} x{item.quantity}
            </Text>
          ))}
        </View>

        {/* Action button */}
        {action && (
          <Button
            mode="contained"
            onPress={handlePress}
            buttonColor={action.color}
            textColor={theme.colors.onPrimary}
            style={styles.actionButton}
            compact
          >
            {action.label}
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    borderRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontWeight: 'bold',
  },
  table: {
    opacity: 0.6,
  },
  itemsList: {
    marginBottom: 10,
  },
  itemText: {
    paddingVertical: 2,
  },
  actionButton: {
    borderRadius: 8,
  },
});

export default React.memo(KitchenOrderCard);
