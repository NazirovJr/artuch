import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, Divider, useTheme } from 'react-native-paper';
import { getReservations, updateReservation } from '../../api/reservations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { confirm } from '../../utils/confirm';
import { semantic } from '../../theme/colors';

type Props = NativeStackScreenProps<RoomsStackParamList, 'ReservationDetail'> & {
  /** Master-detail mode: bypasses route.params for SplitView. */
  reservationIdOverride?: string;
};

export default function ReservationDetailScreen({
  route,
  navigation,
  reservationIdOverride,
}: Props) {
  const reservationId = reservationIdOverride ?? route?.params?.reservationId;
  const theme = useTheme();
  const toast = useToast();
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchReservation = useCallback(async () => {
    if (!reservationId) {
      setReservation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await getReservations();
      const found = all.find((r: any) => r.id === reservationId);
      setReservation(found || null);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleStatusUpdate = async (newStatus: string, label: string) => {
    const ok = await confirm({
      title: 'Подтверждение',
      message: `${label}?`,
      confirmLabel: label,
    });
    if (!ok) return;

    if (!reservationId) return;
    setUpdating(true);
    try {
      const updated = await updateReservation(reservationId, {
        status: newStatus,
        ...(newStatus === 'checked-in' ? { actualCheckIn: new Date().toISOString() } : {}),
        ...(newStatus === 'checked-out' ? { actualCheckOut: new Date().toISOString() } : {}),
      });
      setReservation(updated);

      // Check-in: backend auto-opens a folio and posts the room stay. Give
      // reception a one-tap shortcut to open it — the toast lingers 7s by
      // default so the next guest in line doesn't steal focus.
      if (newStatus === 'checked-in' && updated?.folioId) {
        const price = Number(updated.totalPrice) || 0;
        toast.toast({
          title: 'Заселён — счёт открыт',
          description: price > 0
            ? `Начислено ${price.toFixed(0)} TJS за проживание`
            : 'Счёт создан',
          type: 'success',
          actionLabel: 'Открыть',
          onAction: () =>
            navigation.navigate('FolioDetail', { folioId: updated.folioId }),
        });
      } else {
        toast.show(`${label} — готово`, 'success');
      }
    } catch (e: any) {
      toast.show(e.message || 'Не удалось обновить статус', 'error');
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

  if (!reservation) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Бронирование не найдено</Text>
      </View>
    );
  }

  const guestName = reservation.guest
    ? `${reservation.guest.firstName} ${reservation.guest.lastName}`
    : 'Не указан';

  const status = reservation.status;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
              Бронь #{reservation.reservationNumber || reservation.id?.slice(0, 8)}
            </Text>
            <StatusBadge status={status} domain="reservation" />
          </View>
        </Card.Content>
      </Card>

      {reservation.groupId && (
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          onPress={() =>
            navigation.navigate('BookingGroupDetail', {
              groupId: reservation.groupId,
            })
          }
        >
          <Card.Content>
            <View style={styles.row}>
              <View>
                <Text variant="labelSmall" style={styles.label}>
                  В составе группы
                </Text>
                <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                  {reservation.group?.name ?? 'Группа'}
                </Text>
                {reservation.group?.code && (
                  <Text variant="bodySmall" style={{ opacity: 0.75 }}>
                    {reservation.group.code}
                  </Text>
                )}
              </View>
              <Button
                mode="text"
                icon="arrow-right"
                contentStyle={{ flexDirection: 'row-reverse' }}
                onPress={() =>
                  navigation.navigate('BookingGroupDetail', {
                    groupId: reservation.groupId,
                  })
                }
              >
                Открыть
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Title title="Информация о госте" />
        <Card.Content>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Гость</Text>
            <Text variant="bodyMedium">{guestName}</Text>
          </View>
          {reservation.guest?.phone && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Телефон</Text>
              <Text variant="bodyMedium">{reservation.guest.phone}</Text>
            </View>
          )}
          {reservation.guest?.email && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Email</Text>
              <Text variant="bodyMedium">{reservation.guest.email}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Детали бронирования" />
        <Card.Content>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Номер</Text>
            <Text variant="bodyMedium">#{reservation.roomNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Заезд</Text>
            <Text variant="bodyMedium">
              {reservation.checkInDate
                ? new Date(reservation.checkInDate).toLocaleDateString('ru-RU')
                : '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Выезд</Text>
            <Text variant="bodyMedium">
              {reservation.checkOutDate
                ? new Date(reservation.checkOutDate).toLocaleDateString('ru-RU')
                : '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Гостей</Text>
            <Text variant="bodyMedium">{reservation.numberOfGuests || 1}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="titleMedium">Сумма</Text>
            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {reservation.totalPrice || 0} TJS
            </Text>
          </View>

          {reservation.notes ? (
            <>
              <Divider style={styles.divider} />
              <Text variant="labelSmall" style={styles.label}>Заметки</Text>
              <Text variant="bodyMedium">{reservation.notes}</Text>
            </>
          ) : null}
        </Card.Content>
      </Card>

      {/* Action buttons based on status */}
      <View style={styles.actionsContainer}>
        {(status === 'pending' || status === 'confirmed') && (
          <Button
            mode="contained"
            icon="login"
            onPress={() => handleStatusUpdate('checked-in', 'Заселить')}
            loading={updating}
            disabled={updating}
            style={styles.actionButton}
          >
            Заселить
          </Button>
        )}

        {/* "Open folio" is the fastest path to payment/closeout. Shown
            whenever the reservation has a linked folio — that covers all
            checked-in guests (folio was auto-created on check-in) as well
            as checked-out guests whose folio may still be open for a
            late payment. */}
        {reservation.folioId && (
          <Button
            mode="contained"
            icon="receipt"
            onPress={() => navigation.navigate('FolioDetail', { folioId: reservation.folioId })}
            style={[styles.actionButton, { backgroundColor: semantic.success }]}
          >
            Открыть счёт · принять оплату
          </Button>
        )}

        {status === 'checked-in' && (
          <Button
            mode="contained"
            icon="logout"
            onPress={() => handleStatusUpdate('checked-out', 'Выселить')}
            loading={updating}
            disabled={updating}
            style={styles.actionButton}
          >
            Выселить
          </Button>
        )}

        {status !== 'cancelled' && status !== 'checked-out' && (
          <Button
            mode="outlined"
            icon="close-circle"
            onPress={() => handleStatusUpdate('cancelled', 'Отменить бронирование')}
            loading={updating}
            disabled={updating}
            style={styles.actionButton}
            textColor={semantic.error}
          >
            Отменить
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { margin: 12, marginBottom: 0, borderRadius: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { opacity: 0.6 },
  divider: { marginVertical: 12 },
  actionsContainer: {
    padding: 12,
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
  },
});
