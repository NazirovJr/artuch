import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, Chip } from 'react-native-paper';
import TimerBadge from './TimerBadge';
import { useAppTheme } from '../../hooks/useAppTheme';
import { semantic } from '../../theme/colors';
import type { KdsTicket, KdsItem } from '../../api/kds';

interface Props {
  ticket: KdsTicket;
  onItemStatus: (itemId: string, status: string) => void;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  sent: { label: 'Новое', color: semantic.warning },
  preparing: { label: 'Готовится', color: semantic.info },
  ready: { label: 'Готово', color: semantic.success },
};

// Per-item bump: sent → preparing → ready. Once ready, the waiter serves it
// from the check screen, so the KDS shows no further action.
const ITEM_ACTION: Record<string, { label: string; next: string; color: string } | undefined> = {
  sent: { label: 'Начать', next: 'preparing', color: semantic.info },
  preparing: { label: 'Готово', next: 'ready', color: semantic.success },
};

function KdsTicketCard({ ticket, onItemStatus }: Props) {
  const theme = useAppTheme();

  const handleReadyAll = useCallback(() => {
    for (const it of ticket.items) {
      if (it.status !== 'ready') onItemStatus(it.id, 'ready');
    }
  }, [ticket.items, onItemStatus]);

  const handleServeAll = useCallback(() => {
    for (const it of ticket.items) onItemStatus(it.id, 'served');
  }, [ticket.items, onItemStatus]);

  const allReady = ticket.items.every((i) => i.status === 'ready');
  const hasPending = ticket.items.some((i) => i.status !== 'ready');

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleMedium" style={styles.table}>
              Стол {ticket.tableNumber}
            </Text>
            <Text variant="bodySmall" style={styles.meta}>
              #{ticket.orderNumber} · подход {ticket.roundNumber}
            </Text>
          </View>
          <TimerBadge createdAt={ticket.createdAt} />
        </View>

        <View style={styles.items}>
          {ticket.items.map((item: KdsItem) => {
            const action = ITEM_ACTION[item.status];
            const meta = STATUS_META[item.status];
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text variant="bodyMedium" style={styles.itemName}>
                    {item.menuItemName} ×{item.quantity}
                  </Text>
                  {!!item.notes && (
                    <Text variant="bodySmall" style={styles.notes}>
                      {item.notes}
                    </Text>
                  )}
                </View>
                {action ? (
                  <Button
                    mode="contained"
                    compact
                    buttonColor={action.color}
                    textColor={theme.colors.onPrimary}
                    onPress={() => onItemStatus(item.id, action.next)}
                    style={styles.itemBtn}
                  >
                    {action.label}
                  </Button>
                ) : (
                  <Chip
                    compact
                    style={[styles.chip, { backgroundColor: meta?.color }]}
                    textStyle={styles.chipText}
                  >
                    {meta?.label ?? item.status}
                  </Chip>
                )}
              </View>
            );
          })}
        </View>

        {allReady ? (
          <Button
            mode="contained"
            compact
            buttonColor={semantic.success}
            textColor={theme.colors.onPrimary}
            onPress={handleServeAll}
            style={styles.allBtn}
          >
            Выдать гостю
          </Button>
        ) : hasPending && ticket.items.length > 1 ? (
          <Button
            mode="outlined"
            compact
            onPress={handleReadyAll}
            style={styles.allBtn}
          >
            Всё готово
          </Button>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, borderRadius: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: { flex: 1 },
  table: { fontWeight: 'bold' },
  meta: { opacity: 0.6 },
  items: { gap: 6 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemInfo: { flex: 1 },
  itemName: { fontWeight: '500' },
  notes: { opacity: 0.6, fontStyle: 'italic' },
  itemBtn: { borderRadius: 8, minWidth: 92 },
  chip: { alignSelf: 'center' },
  chipText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  allBtn: { marginTop: 10, borderRadius: 8 },
});

export default React.memo(KdsTicketCard);
