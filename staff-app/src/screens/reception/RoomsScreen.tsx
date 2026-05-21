/**
 * RoomsScreen — adaptive composition of RoomGrid + RoomDetail + CheckIn.
 *
 * Why this exists: the three reception components (RoomGridScreen,
 * RoomDetailScreen, CheckInScreen) have a callback-based API rather than
 * navigation.navigate. That's actually convenient — it lets us host them
 * inside a single React subtree and switch between list/detail/check-in
 * with local state. On phones we render one pane at a time (classic stack
 * feel); on tablet+ the list stays pinned to the left while the detail
 * pane swaps in place.
 *
 * The "Создать гостя" affordance from CheckInScreen still uses real
 * navigation — it pushes the existing `GuestForm` route on top of this
 * screen and pops back when done.
 */
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import RoomGridScreen from './RoomGridScreen';
import RoomDetailScreen from './RoomDetailScreen';
import CheckInScreen from './CheckInScreen';
import SplitView from '../../components/layout/SplitView';
import EmptyState from '../../components/ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useRoomStore } from '../../store/roomStore';
import { getRooms } from '../../api/rooms';
import { getReservations } from '../../api/reservations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RoomsStackParamList, 'RoomGrid'>;

type PaneMode = 'list' | 'detail' | 'checkin';

export default function RoomsScreen({ navigation }: Props) {
  const { isTabletOrWider } = useBreakpoint();
  const { setRooms, setReservations } = useRoomStore();
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [mode, setMode] = useState<PaneMode>('list');

  // Refresh room+reservation lists after a state-changing action (status
  // update, check-in, check-out). Existing detail/checkin screens already
  // call this through `onRefresh`/`onDone`.
  const refresh = useCallback(async () => {
    try {
      const [rooms, reservations] = await Promise.all([getRooms(), getReservations()]);
      setRooms(rooms);
      setReservations(reservations);
    } catch {
      // The grid screen surfaces its own toast on next mount; swallow here
      // so we don't double-toast.
    }
  }, [setRooms, setReservations]);

  const handleSelect = useCallback((room: any) => {
    setSelectedRoom(room);
    setMode('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setMode('list');
    // On tablet+ we keep `selectedRoom` so the right pane still shows the
    // last detail view. On phone the user is already swapping panes so
    // clearing it doesn't matter visually.
  }, []);

  const handleCheckIn = useCallback((room: any) => {
    setSelectedRoom(room);
    setMode('checkin');
  }, []);

  const handleCheckInDone = useCallback(async () => {
    await refresh();
    setMode('detail');
  }, [refresh]);

  const list = <RoomGridScreen onSelectRoom={handleSelect} />;

  const detailPane =
    mode === 'checkin' && selectedRoom ? (
      <CheckInScreen
        preselectedRoom={selectedRoom}
        onBack={() => setMode('detail')}
        onDone={handleCheckInDone}
        onCreateGuest={() => navigation.navigate('GuestForm')}
      />
    ) : selectedRoom ? (
      <RoomDetailScreen
        room={selectedRoom}
        onBack={handleBackToList}
        onCheckIn={handleCheckIn}
        onRefresh={refresh}
      />
    ) : null;

  const emptyDetail = (
    <View style={styles.empty}>
      <EmptyState
        icon="bed-outline"
        title="Выберите номер"
        subtitle="Нажмите на карточку слева, чтобы посмотреть детали и действия."
      />
    </View>
  );

  // Phone: SplitView's `mode` decides which pane is rendered. On tablet+
  // the same SplitView shows both panes side-by-side.
  return (
    <SplitView
      list={list}
      detail={detailPane}
      mode={mode === 'list' ? 'list' : 'detail'}
      emptyDetail={emptyDetail}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', padding: 24 },
});
