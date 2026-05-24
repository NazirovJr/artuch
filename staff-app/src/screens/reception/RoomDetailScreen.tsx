import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, Chip, Divider, useTheme, Menu } from 'react-native-paper';
import { updateRoom } from '../../api/rooms';
import { updateReservation } from '../../api/reservations';
import { RoomType, getRoomType } from '../../api/room-types';
import RoomTypeInfoCard from '../../components/RoomTypeInfoCard';
import { useRoomStore } from '../../store/roomStore';
import { semantic, semanticSoft } from '../../theme/colors';

const STATUS_LABELS: Record<string, string> = {
  available: 'Свободен',
  occupied: 'Занят',
  maintenance: 'Обслуживание',
};

const CLEANING_LABELS: Record<string, string> = {
  clean: 'Чисто',
  'needs-cleaning': 'Требует уборки',
  'in-progress': 'Убирается',
};

interface Props {
  room: any;
  onBack: () => void;
  onCheckIn: (room: any) => void;
  onRefresh: () => void;
}

export default function RoomDetailScreen({ room, onBack, onCheckIn, onRefresh }: Props) {
  const theme = useTheme();
  const { reservations } = useRoomStore();
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roomType, setRoomType] = useState<RoomType | null>(
    room.roomType ?? null,
  );

  // Lazy-fetch the type details if the embedded relation is missing — keeps
  // RoomTypeInfoCard always populated regardless of how the room object got
  // here (Zustand cache, in-memory state, etc.).
  useEffect(() => {
    if (roomType || !room.roomTypeId) return;
    let cancelled = false;
    getRoomType(room.roomTypeId)
      .then((rt) => {
        if (!cancelled) setRoomType(rt);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [room.roomTypeId, roomType]);

  const currentReservation = reservations.find(
    (r: any) => r.roomNumber === room.number && (r.status === 'checked-in' || r.status === 'confirmed'),
  );

  const handleStatusChange = async (newStatus: string) => {
    setStatusMenuVisible(false);
    setLoading(true);
    try {
      await updateRoom(room.number, { status: newStatus });
      onRefresh();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось обновить статус');
    } finally {
      setLoading(false);
    }
  };

  const handleCleaningToggle = async () => {
    const newStatus = room.cleaningStatus === 'clean' ? 'needs-cleaning' : 'clean';
    setLoading(true);
    try {
      await updateRoom(room.number, { cleaningStatus: newStatus });
      onRefresh();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось обновить статус уборки');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentReservation) return;
    Alert.alert('Подтверждение', 'Выселить гостя?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выселить',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await updateReservation(currentReservation.id, {
              status: 'checked-out',
              actualCheckOut: new Date().toISOString(),
            });
            onRefresh();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось выселить');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Button icon="arrow-left" onPress={onBack} style={styles.backButton}>
        Назад
      </Button>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.roomTitle}>
            Номер #{room.number}
          </Text>
          <Text variant="bodyLarge" style={styles.roomType}>
            {roomType?.name ?? room.type}
          </Text>
          {(room.floor != null || room.location) && (
            <Text variant="bodySmall" style={styles.aux}>
              {room.floor != null && `Этаж ${room.floor}`}
              {room.floor != null && room.location ? ' · ' : ''}
              {room.location}
            </Text>
          )}

          <Divider style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.label}>Кроватей</Text>
              <Text variant="bodyLarge">{room.beds}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.label}>Макс. гостей</Text>
              <Text variant="bodyLarge">{room.maxGuests}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.label}>Цена/ночь</Text>
              <Text variant="bodyLarge">{room.pricePerNight} TJS</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {roomType && (
        <View style={styles.typeCardWrap}>
          <RoomTypeInfoCard roomType={roomType} />
        </View>
      )}

      <Card style={styles.card}>
        <Card.Title title="Статус" />
        <Card.Content>
          <View style={styles.statusRow}>
            {(() => {
              const pair =
                room.status === 'available'
                  ? semanticSoft.success
                  : room.status === 'occupied'
                  ? semanticSoft.error
                  : semanticSoft.warning;
              return (
                <Chip
                  selected={room.status === 'available'}
                  style={[styles.statusChip, { backgroundColor: pair.bg }]}
                  textStyle={{ color: pair.fg }}
                >
                  {STATUS_LABELS[room.status] || room.status}
                </Chip>
              );
            })()}

            <Menu
              visible={statusMenuVisible}
              onDismiss={() => setStatusMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setStatusMenuVisible(true)}
                  disabled={loading}
                  compact
                >
                  Изменить
                </Button>
              }
            >
              <Menu.Item onPress={() => handleStatusChange('available')} title="Свободен" />
              <Menu.Item onPress={() => handleStatusChange('occupied')} title="Занят" />
              <Menu.Item onPress={() => handleStatusChange('maintenance')} title="Обслуживание" />
            </Menu>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statusRow}>
            <Text variant="bodyMedium">Уборка:</Text>
            {(() => {
              const pair = room.cleaningStatus === 'clean' ? semanticSoft.success : semanticSoft.error;
              return (
                <Chip
                  onPress={handleCleaningToggle}
                  style={{ backgroundColor: pair.bg }}
                  textStyle={{ color: pair.fg }}
                >
                  {CLEANING_LABELS[room.cleaningStatus] || room.cleaningStatus}
                </Chip>
              );
            })()}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Действия" />
        <Card.Content>
          {room.status === 'available' && (
            <Button
              mode="contained"
              icon="login"
              onPress={() => onCheckIn(room)}
              style={styles.actionButton}
              disabled={loading}
            >
              Заселить
            </Button>
          )}
          {room.status === 'occupied' && currentReservation && (
            <Button
              mode="contained"
              icon="logout"
              onPress={handleCheckOut}
              style={styles.actionButton}
              buttonColor={semantic.error}
              disabled={loading}
            >
              Выселить
            </Button>
          )}
        </Card.Content>
      </Card>

      {currentReservation && (
        <Card style={styles.card}>
          <Card.Title title="Текущая бронь" />
          <Card.Content>
            <Text variant="bodyMedium">
              Гость: {currentReservation.guest?.firstName} {currentReservation.guest?.lastName}
            </Text>
            <Text variant="bodySmall" style={styles.reservationInfo}>
              Заезд: {currentReservation.checkInDate}
            </Text>
            <Text variant="bodySmall" style={styles.reservationInfo}>
              Выезд: {currentReservation.checkOutDate}
            </Text>
            <Text variant="bodySmall" style={styles.reservationInfo}>
              Гостей: {currentReservation.numberOfGuests}
            </Text>
            <Text variant="bodySmall" style={styles.reservationInfo}>
              Сумма: {currentReservation.totalPrice} TJS
            </Text>
            {currentReservation.notes ? (
              <Text variant="bodySmall" style={styles.reservationInfo}>
                Заметки: {currentReservation.notes}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { alignSelf: 'flex-start', margin: 8 },
  card: { margin: 12, marginBottom: 0 },
  roomTitle: { fontWeight: 'bold' },
  roomType: { textTransform: 'capitalize', opacity: 0.7, marginTop: 4 },
  divider: { marginVertical: 12 },
  infoGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { alignItems: 'center' },
  label: { opacity: 0.5, marginBottom: 4 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  statusChip: { marginRight: 8 },
  actionButton: { marginVertical: 4 },
  reservationInfo: { marginTop: 4, opacity: 0.7 },
  aux: { marginTop: 4, opacity: 0.7 },
  typeCardWrap: { paddingHorizontal: 12 },
});
