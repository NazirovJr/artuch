import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, SectionList } from 'react-native';
import { Card, Text, FAB, Searchbar, useTheme } from 'react-native-paper';
import { getReservations } from '../../api/reservations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useToast } from '../../components/ui/Toast';

type Props = NativeStackScreenProps<RoomsStackParamList, 'ReservationList'> & {
  /** Master-detail mode: tap calls this instead of navigating. */
  onSelectReservation?: (reservationId: string) => void;
  selectedReservationId?: string | null;
};

const STATUS_ORDER = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'];

const SECTION_TITLES: Record<string, string> = {
  pending: 'Ожидающие',
  confirmed: 'Подтверждённые',
  'checked-in': 'Заселённые',
  'checked-out': 'Выселенные',
  cancelled: 'Отменённые',
};

export default function ReservationListScreen({
  navigation,
  onSelectReservation,
  selectedReservationId,
}: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openReservation = useCallback(
    (reservationId: string) => {
      if (onSelectReservation) onSelectReservation(reservationId);
      else navigation.navigate('ReservationDetail', { reservationId });
    },
    [onSelectReservation, navigation],
  );

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReservations();
      setReservations(data);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchReservations();
    });
    return unsubscribe;
  }, [navigation, fetchReservations]);

  const filtered = reservations.filter((r: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const guestName = `${r.guest?.firstName || ''} ${r.guest?.lastName || ''}`.toLowerCase();
    const reservationNumber = String(r.reservationNumber || r.id || '').toLowerCase();
    return guestName.includes(q) || reservationNumber.includes(q);
  });

  const sections = STATUS_ORDER
    .map((status) => ({
      title: SECTION_TITLES[status] || status,
      status,
      data: filtered.filter((r: any) => r.status === status),
    }))
    .filter((s) => s.data.length > 0);

  const renderReservation = ({ item }: { item: any }) => {
    const guestName = item.guest
      ? `${item.guest.firstName} ${item.guest.lastName}`
      : 'Гость не указан';

    return (
      <Card
        style={[
          styles.card,
          selectedReservationId === item.id && {
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        onPress={() => openReservation(item.id)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Text variant="titleMedium" style={styles.resNumber}>
                #{item.reservationNumber || item.id?.slice(0, 8)}
              </Text>
              {item.groupId && (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.groupBadge,
                    { color: theme.colors.primary },
                  ]}
                >
                  ◇ В группе
                </Text>
              )}
            </View>
            <StatusBadge status={item.status} domain="reservation" />
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Гость:</Text>
            <Text variant="bodyMedium">{guestName}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Номер:</Text>
            <Text variant="bodyMedium">#{item.roomNumber}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Заезд:</Text>
            <Text variant="bodyMedium">
              {item.checkInDate
                ? new Date(item.checkInDate).toLocaleDateString('ru-RU')
                : '-'}
            </Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Выезд:</Text>
            <Text variant="bodyMedium">
              {item.checkOutDate
                ? new Date(item.checkOutDate).toLocaleDateString('ru-RU')
                : '-'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <ScreenContainer maxWidth="grid">
      <Searchbar
        placeholder="Поиск по имени или номеру"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />

      <View style={styles.toolbar}>
        <FAB
          mode="flat"
          size="small"
          icon="account-group"
          label="Группы"
          onPress={() => navigation.navigate('BookingGroupList')}
          style={styles.calendarFab}
          variant="surface"
        />
        <FAB
          mode="flat"
          size="small"
          icon="calendar-month"
          label="Календарь"
          onPress={() => navigation.navigate('ReservationCalendar')}
          style={styles.calendarFab}
          variant="surface"
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderReservation}
        renderSectionHeader={({ section }) => (
          <Text variant="titleSmall" style={styles.sectionTitle}>
            {section.title} ({section.data.length})
          </Text>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchReservations} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="calendar-clock" title="Нет бронирований" />
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('NewReservation')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 12, marginBottom: 0 },
  toolbar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  calendarFab: { borderRadius: 24 },
  sectionTitle: {
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 4,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resNumber: { fontWeight: 'bold' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  groupBadge: { fontWeight: '600', opacity: 0.85 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: { opacity: 0.6, marginRight: 4 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
  },
});
