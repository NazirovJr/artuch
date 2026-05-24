import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import KdsTicketCard from '../../components/kitchen/KdsTicketCard';
import { getKdsQueue, updateKdsItemStatus, type KdsTicket, type Station } from '../../api/kds';
import { useSocketEvent } from '../../socket/useSocketEvent';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useHaptics } from '../../hooks/useHaptics';
import { useKitchenSound } from '../../hooks/useKitchenSound';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const POLL_INTERVAL = 10_000;

interface Props {
  station: Station;
  title: string;
}

/**
 * Shared kitchen / bar display. Renders the station's active tickets (rounds),
 * lets staff bump each line sent → preparing → ready, and clear a fully-ready
 * ticket with "Выдать гостю". Refreshes on a 10s poll and on the `kds:updated`
 * socket event for its station; plays a chime + haptic when new tickets land.
 */
export default function StationKdsScreen({ station, title }: Props) {
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const prevCountRef = useRef(0);

  const theme = useAppTheme();
  const haptics = useHaptics();
  const { playNewOrder } = useKitchenSound();
  const { width, isPhone } = useBreakpoint();

  const numColumns = isPhone ? 1 : width >= 1200 ? 3 : 2;

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getKdsQueue(station);
      const count = data.reduce((n, t) => n + t.items.length, 0);
      if (prevCountRef.current > 0 && count > prevCountRef.current) {
        playNewOrder();
        haptics.warning();
      }
      prevCountRef.current = count;
      setTickets(data);
    } catch {
      // keep last good state; next poll retries
    } finally {
      setLoading(false);
    }
  }, [station, playNewOrder, haptics]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    const id = setInterval(fetchQueue, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchQueue]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Live refresh when our station changes server-side.
  const onKds = useCallback(
    (data: { station?: string }) => {
      if (!data?.station || data.station === station) fetchQueue();
    },
    [station, fetchQueue],
  );
  useSocketEvent('kds:updated', onKds);

  const handleItemStatus = useCallback(
    async (itemId: string, status: string) => {
      haptics.medium();
      // Optimistic: update locally; drop served items and emptied tickets.
      setTickets((prev) =>
        prev
          .map((t) => ({
            ...t,
            items:
              status === 'served'
                ? t.items.filter((i) => i.id !== itemId)
                : t.items.map((i) =>
                    i.id === itemId ? { ...i, status } : i,
                  ),
          }))
          .filter((t) => t.items.length > 0),
      );
      try {
        await updateKdsItemStatus(itemId, status);
        if (status === 'ready' || status === 'served') haptics.success();
      } catch {
        haptics.error();
        fetchQueue();
      }
    },
    [haptics, fetchQueue],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchQueue();
    setRefreshing(false);
  }, [fetchQueue]);

  const totalItems = tickets.reduce((n, t) => n + t.items.length, 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.muted}>
          Загрузка…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <Text variant="headlineSmall" style={styles.title}>
          {title}
          {totalItems > 0 ? `  ·  ${totalItems}` : ''}
        </Text>
        <Text variant="bodyMedium" style={styles.clock}>
          {now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Text>
      </View>

      <FlatList
        key={`cols-${numColumns}`}
        data={tickets}
        keyExtractor={(t) => t.orderId}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? styles.cell : undefined}>
            <KdsTicketCard ticket={item} onItemStatus={handleItemStatus} />
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text variant="bodyLarge" style={styles.muted}>
              Нет активных заказов
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  muted: { opacity: 0.5 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontWeight: 'bold' },
  clock: { opacity: 0.6, fontVariant: ['tabular-nums'] },
  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12 },
  cell: { flex: 1 },
});
