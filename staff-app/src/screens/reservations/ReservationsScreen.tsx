/**
 * ReservationsScreen — adaptive list/detail for reservations.
 *
 * Phone: identical UX to before — tapping a row pushes ReservationDetail.
 * Tablet+: split layout with the list on the left and the selected
 * reservation's detail/actions on the right. Selecting another row swaps
 * the right pane in place — no navigation push.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ReservationListScreen from './ReservationListScreen';
import ReservationDetailScreen from './ReservationDetailScreen';
import SplitView from '../../components/layout/SplitView';
import EmptyState from '../../components/ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RoomsStackParamList, 'ReservationList'>;

export default function ReservationsScreen(props: Props) {
  const { isTabletOrWider } = useBreakpoint();
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  if (!isTabletOrWider) {
    return <ReservationListScreen {...props} />;
  }

  const list = (
    <ReservationListScreen
      {...props}
      onSelectReservation={setSelectedReservationId}
      selectedReservationId={selectedReservationId}
    />
  );

  const detail = selectedReservationId ? (
    <ReservationDetailScreen
      {...(props as any)}
      reservationIdOverride={selectedReservationId}
    />
  ) : null;

  const empty = (
    <View style={styles.empty}>
      <EmptyState
        icon="calendar-clock-outline"
        title="Выберите бронирование"
        subtitle="Тапните строку слева, чтобы посмотреть детали и обновить статус."
      />
    </View>
  );

  return <SplitView list={list} detail={detail} emptyDetail={empty} />;
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', padding: 24 },
});
