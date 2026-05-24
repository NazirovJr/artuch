import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Button,
  Divider,
  Icon,
  Chip,
  useTheme,
} from 'react-native-paper';
import { getCheck, cancelCheck, type TableCheck, type CheckItem } from '../../api/checks';
import { updateKdsItemStatus } from '../../api/kds';
import { useSocketEvent } from '../../socket/useSocketEvent';
import { useToast } from '../../components/ui/Toast';
import { useManagerApproval } from '../../hooks/useManagerApproval';
import ManagerPinDialog from '../../components/ManagerPinDialog';
import { semantic } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'CheckDetail'>;

const STATION_ICON: Record<string, string> = {
  kitchen: 'pot-steam',
  bar: 'glass-cocktail',
  none: 'room-service-outline',
};

const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  sent: { label: 'На кухню', color: semantic.warning },
  preparing: { label: 'Готовится', color: semantic.info },
  ready: { label: 'Готово', color: semantic.success },
  served: { label: 'Подано', color: semantic.muted },
  cancelled: { label: 'Отменено', color: semantic.muted },
};

export default function CheckDetailScreen({ route, navigation }: Props) {
  const { checkId } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const [check, setCheck] = useState<TableCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const { request, dialogProps } = useManagerApproval();

  const fetchCheck = useCallback(async () => {
    try {
      setCheck(await getCheck(checkId));
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить счёт', 'error');
      // Access denied / gone (e.g. another waiter's check): leave the screen
      // rather than showing an empty shell.
      if (e?.status === 403 || e?.status === 404) {
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [checkId, toast, navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchCheck);
    return unsub;
  }, [navigation, fetchCheck]);

  const onRealtime = useCallback(
    (data: { checkId?: string; id?: string }) => {
      // check:* payloads carry the check; kds:updated has none — refetch anyway.
      if (!data || data.checkId === checkId || data.id === checkId || !data.id) {
        fetchCheck();
      }
    },
    [checkId, fetchCheck],
  );
  useSocketEvent('check:updated', onRealtime);
  useSocketEvent('kds:updated', onRealtime);

  const handleServe = useCallback(
    async (item: CheckItem) => {
      try {
        await updateKdsItemStatus(item.id, 'served');
        fetchCheck();
      } catch (e: any) {
        toast.show(e.message || 'Ошибка', 'error');
      }
    },
    [fetchCheck, toast],
  );

  const handleCancel = useCallback(() => {
    request('Отмена счёта', async (pin) => {
      await cancelCheck(checkId, pin);
      navigation.goBack();
    });
  }, [request, checkId, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Загрузка…</Text>
      </View>
    );
  }
  if (!check) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Счёт не найден</Text>
      </View>
    );
  }

  const closed = check.status !== 'open';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                Стол {check.tableNumber}
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {Number(check.total).toFixed(2)} TJS
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.meta}>
              Счёт #{check.checkNumber}
              {check.openedByName ? ` · ${check.openedByName}` : ''}
              {closed ? ` · ${check.status === 'closed' ? 'оплачен' : 'отменён'}` : ''}
            </Text>
          </Card.Content>
        </Card>

        {(check.orders || []).map((round) => (
          <Card key={round.id} style={styles.roundCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.roundTitle}>
                Заказ {round.roundNumber}
                <Text style={styles.meta}>
                  {'  '}
                  {new Date(round.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Text>
              <Divider style={styles.divider} />
              {(round.items || [])
                .filter((it) => it.status !== 'cancelled')
                .map((it) => {
                  const meta = ITEM_STATUS[it.status] ?? ITEM_STATUS.sent;
                  return (
                    <View key={it.id} style={styles.itemRow}>
                      <Icon source={STATION_ICON[it.station] || 'silverware-fork-knife'} size={18} color={theme.colors.onSurfaceVariant} />
                      <View style={styles.itemInfo}>
                        <Text variant="bodyMedium">
                          {it.menuItemName} ×{it.quantity}
                        </Text>
                        {!!it.notes && (
                          <Text variant="bodySmall" style={styles.notes}>
                            {it.notes}
                          </Text>
                        )}
                      </View>
                      {it.status === 'ready' ? (
                        <Button
                          mode="contained"
                          compact
                          buttonColor={semantic.success}
                          textColor={theme.colors.onPrimary}
                          onPress={() => handleServe(it)}
                        >
                          Подано
                        </Button>
                      ) : (
                        <Chip compact style={[styles.statusChip, { backgroundColor: meta.color }]} textStyle={styles.statusText}>
                          {meta.label}
                        </Chip>
                      )}
                      <Text variant="bodySmall" style={styles.price}>
                        {(Number(it.menuItemPrice) * it.quantity).toFixed(0)}
                      </Text>
                    </View>
                  );
                })}
            </Card.Content>
          </Card>
        ))}

        <Card style={styles.totalCard}>
          <Card.Content>
            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.meta}>Подытог</Text>
              <Text variant="bodyMedium">{Number(check.subtotal).toFixed(2)} TJS</Text>
            </View>
            {Number(check.discountTotal) > 0 && (
              <View style={styles.totalRow}>
                <Text variant="bodyMedium" style={styles.meta}>Скидка</Text>
                <Text variant="bodyMedium">−{Number(check.discountTotal).toFixed(2)} TJS</Text>
              </View>
            )}
            <Divider style={styles.divider} />
            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Итого</Text>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {Number(check.total).toFixed(2)} TJS
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {!closed && (
        <View style={[styles.actions, { borderTopColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
          <Button
            mode="contained-tonal"
            icon="plus"
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddRound', { checkId, tableNumber: check.tableNumber })}
          >
            Добавить заказ
          </Button>
          <Button
            mode="contained"
            icon="cash-register"
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Settlement', { checkId })}
          >
            Оплатить
          </Button>
        </View>
      )}
      {!closed && (
        <Button
          mode="text"
          textColor={theme.colors.error}
          onPress={handleCancel}
          style={styles.cancelBtn}
        >
          Отменить счёт
        </Button>
      )}

      <ManagerPinDialog {...dialogProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 12, paddingBottom: 16 },
  headerCard: { borderRadius: 12, marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { opacity: 0.6 },
  roundCard: { borderRadius: 12, marginBottom: 10 },
  roundTitle: { fontWeight: 'bold' },
  divider: { marginVertical: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  itemInfo: { flex: 1 },
  notes: { opacity: 0.6, fontStyle: 'italic' },
  statusChip: {},
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  price: { width: 44, textAlign: 'right', opacity: 0.7 },
  totalCard: { borderRadius: 12, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1 },
  actionBtn: { flex: 1, borderRadius: 8 },
  cancelBtn: { marginBottom: 8 },
});
