import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { getOrders, updateOrderStatus } from '../../api/orders';
import KitchenOrderCard from '../../components/kitchen/KitchenOrderCard';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useHaptics } from '../../hooks/useHaptics';
import { useKitchenSound } from '../../hooks/useKitchenSound';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { semantic } from '../../theme/colors';
import { onPrimaryOverlay } from '../../theme/palette';
import { spacing } from '../../theme/spacing';

const POLL_INTERVAL = 10_000; // 10 seconds

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

interface ColumnConfig {
  status: string;
  title: string;
  color: string;
}

const COLUMNS: ColumnConfig[] = [
  { status: 'pending', title: 'Ожидание', color: semantic.warning },
  { status: 'preparing', title: 'Готовится', color: semantic.info },
  { status: 'ready', title: 'Готово', color: semantic.success },
];

export default function KitchenScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingColumn, setRefreshingColumn] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const prevPendingCountRef = useRef(0);
  const theme = useAppTheme();
  const haptics = useHaptics();
  const { playNewOrder } = useKitchenSound();
  const { width, isPhone } = useBreakpoint();

  // Phone: horizontal swipe between 3 columns, each ~85% of viewport (one
  // visible column at a time). Tablet+: all 3 columns fit side-by-side, no
  // horizontal scroll. Width is reactive — orientation changes recompute
  // immediately, unlike the old static Dimensions.get() at module load.
  const horizontalScroll = isPhone;
  const columnWidth = isPhone
    ? width * 0.85
    : (width - spacing.md * 4) / COLUMNS.length;

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getOrders();
      const activeOrders = (data as Order[]).filter(
        (o) => o.status !== 'completed'
      );

      // Play chime + haptic when new pending orders land between polls.
      // Skip on initial load (prev = 0) so the kitchen doesn't get pinged
      // for the existing backlog.
      const newPendingCount = activeOrders.filter(
        (o) => o.status === 'pending'
      ).length;
      if (
        prevPendingCountRef.current > 0 &&
        newPendingCount > prevPendingCountRef.current
      ) {
        playNewOrder();
        haptics.warning();
      }
      prevPendingCountRef.current = newPendingCount;

      setOrders(activeOrders);
    } catch {
      // Silently ignore — will retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Clock update every second for header
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = useCallback(
    async (orderId: string, newStatus: string) => {
      // Tactile feedback as soon as the user taps — don't wait for the
      // network round-trip; on slow connections that's 300ms+ of dead air.
      haptics.medium();
      try {
        await updateOrderStatus(orderId, newStatus);
        // Optimistic update: move the order to the new status locally
        setOrders((prev) =>
          prev
            .map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
            .filter((o) => o.status !== 'completed')
        );
        if (newStatus === 'ready' || newStatus === 'completed') {
          haptics.success();
        }
      } catch {
        haptics.error();
        // On error, re-fetch to get the correct state
        fetchOrders();
      }
    },
    [fetchOrders, haptics]
  );

  const handleColumnRefresh = useCallback(
    async (status: string) => {
      setRefreshingColumn(status);
      await fetchOrders();
      setRefreshingColumn(null);
    },
    [fetchOrders]
  );

  const getOrdersForStatus = useCallback(
    (status: string) => orders.filter((o) => o.status === status),
    [orders]
  );

  const renderOrderCard = useCallback(
    ({ item }: { item: Order }) => (
      <KitchenOrderCard order={item} onStatusChange={handleStatusChange} />
    ),
    [handleStatusChange]
  );

  const keyExtractor = useCallback((item: Order) => item.id, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Загрузка заказов...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Кухня
        </Text>
        <Text variant="bodyMedium" style={styles.headerTime}>
          {currentTime.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Text>
      </View>

      {/* Kanban columns: horizontal scroll on phones, fits side-by-side on tablet+ */}
      <ScrollView
        horizontal={horizontalScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.columnsContainer,
          !horizontalScroll && styles.columnsContainerWide,
        ]}
        pagingEnabled={false}
      >
        {COLUMNS.map((column) => {
          const columnOrders = getOrdersForStatus(column.status);
          return (
            <View key={column.status} style={[styles.column, { width: columnWidth }]}>
              {/* Column header */}
              <View
                style={[styles.columnHeader, { backgroundColor: column.color }]}
              >
                <Text variant="titleMedium" style={styles.columnTitle}>
                  {column.title}
                </Text>
                <View style={styles.countBadge}>
                  <Text variant="labelSmall" style={styles.countText}>
                    {columnOrders.length}
                  </Text>
                </View>
              </View>

              {/* Column orders list */}
              <FlatList
                data={columnOrders}
                keyExtractor={keyExtractor}
                renderItem={renderOrderCard}
                contentContainerStyle={styles.columnList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingColumn === column.status}
                    onRefresh={() => handleColumnRefresh(column.status)}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyColumn}>
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      Нет заказов
                    </Text>
                  </View>
                }
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    // borderBottomColor injected inline via theme.colors.outlineVariant
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerTime: {
    opacity: 0.6,
    fontVariant: ['tabular-nums'],
  },
  columnsContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 10,
  },
  // When all columns fit side-by-side we need a row container that fills
  // the screen height (ScrollView with horizontal=false defaults to vertical
  // stacking).
  columnsContainerWide: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  column: {
    flexShrink: 0, // width is set inline from `columnWidth`
    marginHorizontal: 4,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  columnTitle: {
    // White on saturated semantic.warning/info/success — WCAG-AA across all 3.
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  countBadge: {
    backgroundColor: onPrimaryOverlay.soft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  columnList: {
    paddingBottom: 20,
  },
  emptyColumn: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    opacity: 0.4,
  },
});
