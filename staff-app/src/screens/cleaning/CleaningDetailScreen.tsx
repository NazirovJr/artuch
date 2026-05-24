import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, Divider, TextInput, useTheme } from 'react-native-paper';
import { getRooms, updateRoom } from '../../api/rooms';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CleaningStackParamList } from '../../navigation/types';
import { cleaningStatusColors, cleaningStatusLabels, cleaningNextStatus, semantic } from '../../theme/colors';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningDetail'>;

const NEXT_ACTION_LABELS: Record<string, string> = {
  'needs-cleaning': 'Начать уборку',
  cleaning: 'Завершить уборку',
  clean: 'Отметить грязным',
  pending: 'Начать уборку',
};

const NEXT_ACTION_ICONS: Record<string, string> = {
  'needs-cleaning': 'broom',
  cleaning: 'check-circle',
  clean: 'alert-circle',
  pending: 'broom',
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  standard: 'Стандарт',
  deluxe: 'Делюкс',
  suite: 'Люкс',
  cottage: 'Коттедж',
};

export default function CleaningDetailScreen({ route, navigation }: Props) {
  const { roomNumber } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchRoom = useCallback(async () => {
    setLoading(true);
    try {
      const rooms = await getRooms();
      const found = rooms.find((r: any) => r.number === roomNumber);
      setRoom(found || null);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [roomNumber]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const handleStatusChange = async () => {
    if (!room) return;
    const nextStatus = cleaningNextStatus[room.cleaningStatus] || 'needs-cleaning';
    setUpdating(true);
    try {
      await updateRoom(room.number, { cleaningStatus: nextStatus });
      await fetchRoom();
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

  if (!room) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Номер не найден</Text>
      </View>
    );
  }

  const statusColor = cleaningStatusColors[room.cleaningStatus] || semantic.neutral;
  const statusLabel = cleaningStatusLabels[room.cleaningStatus] || room.cleaningStatus;
  const actionLabel = NEXT_ACTION_LABELS[room.cleaningStatus] || 'Обновить';
  const actionIcon = NEXT_ACTION_ICONS[room.cleaningStatus] || 'update';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.roomTitle}>
            Номер #{room.number}
          </Text>
          <Text variant="bodyLarge" style={styles.roomType}>
            {ROOM_TYPE_LABELS[room.type] || room.type}
          </Text>

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
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Статус уборки" />
        <Card.Content>
          <View
            style={[
              styles.statusContainer,
              { backgroundColor: statusColor + '20', borderColor: statusColor },
            ]}
          >
            <Text variant="titleLarge" style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>

          {room.lastCleanedAt && (
            <Text variant="bodySmall" style={styles.lastCleaned}>
              Последняя уборка: {new Date(room.lastCleanedAt).toLocaleString('ru-RU')}
            </Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Заметки" />
        <Card.Content>
          <TextInput
            mode="outlined"
            placeholder="Добавить заметку..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon={actionIcon}
        onPress={handleStatusChange}
        loading={updating}
        disabled={updating}
        style={styles.actionButton}
        contentStyle={styles.actionButtonContent}
        buttonColor={
          room.cleaningStatus === 'clean' ? semantic.error : theme.colors.primary
        }
      >
        {actionLabel}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { margin: 12, marginBottom: 0, borderRadius: 12 },
  roomTitle: { fontWeight: 'bold' },
  roomType: { textTransform: 'capitalize', opacity: 0.7, marginTop: 4 },
  divider: { marginVertical: 12 },
  infoGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { alignItems: 'center' },
  label: { opacity: 0.5, marginBottom: 4 },
  statusContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: { fontWeight: 'bold' },
  lastCleaned: { opacity: 0.5, textAlign: 'center', marginTop: 4 },
  notesInput: { marginBottom: 4 },
  actionButton: {
    margin: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  actionButtonContent: { paddingVertical: 8 },
});
