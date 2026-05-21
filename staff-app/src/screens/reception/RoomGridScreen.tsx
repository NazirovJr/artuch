import React, { useCallback, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, Badge, useTheme } from 'react-native-paper';
import { useRoomStore } from '../../store/roomStore';
import { getRooms } from '../../api/rooms';
import { getReservations } from '../../api/reservations';
import { roomStatusColors, cleaningStatusLabels, cleaningBadgeColors, semantic } from '../../theme/colors';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { rv } from '../../utils/responsive';

interface Props {
  onSelectRoom: (room: any) => void;
}

export default function RoomGridScreen({ onSelectRoom }: Props) {
  const { rooms, loading, setRooms, setLoading } = useRoomStore();
  const theme = useTheme();
  const toast = useToast();
  const { bp } = useBreakpoint();
  const numColumns = rv({ phone: 2, tablet: 3, desktop: 4, wide: 6 }, bp);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsData, reservationsData] = await Promise.all([
        getRooms(),
        getReservations(),
      ]);
      setRooms(roomsData);
      useRoomStore.getState().setReservations(reservationsData);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [setRooms, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderRoom = ({ item }: { item: any }) => {
    const statusColor = roomStatusColors[item.status] || semantic.neutral;
    const cleaningLabel = cleaningStatusLabels[item.cleaningStatus] || item.cleaningStatus;
    const badgeTone = cleaningBadgeColors[item.cleaningStatus] || cleaningBadgeColors.pending;

    return (
      <Card
        style={[styles.card, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}
        onPress={() => onSelectRoom(item)}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text variant="headlineSmall" style={styles.roomNumber}>
              #{item.number}
            </Text>
            <StatusBadge status={item.status} domain="room" />
          </View>

          <Text variant="bodyMedium" style={styles.roomType}>
            {item.type}
          </Text>

          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.infoText}>
              Кроватей: {item.beds}
            </Text>
            <Text variant="bodySmall" style={styles.infoText}>
              Макс. гостей: {item.maxGuests}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.priceText}>
              {item.pricePerNight} TJS / ночь
            </Text>
            <Badge
              style={[
                styles.cleaningBadge,
                { backgroundColor: badgeTone.background, color: badgeTone.text },
              ]}
            >
              {cleaningLabel}
            </Badge>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={styles.title}>
        Номера
      </Text>
      <FlatList
        key={`rooms-grid-${numColumns}`}
        data={rooms}
        renderItem={renderRoom}
        keyExtractor={(item) => String(item.number)}
        numColumns={numColumns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="door-open" title="Номера не найдены" />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { padding: 16, paddingBottom: 8, fontWeight: 'bold' },
  list: { padding: 8 },
  row: { justifyContent: 'space-between' },
  card: {
    flex: 1,
    margin: 4,
    // No maxWidth — flex spreads cards across `numColumns`, computed responsively.
  },
  cardContent: { paddingVertical: 8 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomNumber: { fontWeight: 'bold' },
  roomType: { marginBottom: 4, textTransform: 'capitalize' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: { opacity: 0.7 },
  priceText: { fontWeight: '600' },
  cleaningBadge: { fontSize: 10, paddingHorizontal: 6 },
});
