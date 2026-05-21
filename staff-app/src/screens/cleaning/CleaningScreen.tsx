/**
 * CleaningScreen — adaptive list/detail wrapper for housekeeping tasks.
 *
 * Phone: list pushes detail/inspection on tap (unchanged).
 * Tablet+ (typical iPad-on-cleaning-cart workflow): SplitView with the
 * task queue on the left, the active checklist on the right. Switching
 * tasks doesn't unmount the right pane — it re-fetches in place, which
 * keeps cleaners' scroll position predictable when they jump between
 * rooms.
 *
 * Inspection tasks (status='review') still push a real screen because
 * the inspector needs camera + freeform note UI that doesn't fit in a
 * side pane.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import CleaningListScreen from './CleaningListScreen';
import CleaningTaskDetailScreen from './CleaningTaskDetailScreen';
import SplitView from '../../components/layout/SplitView';
import EmptyState from '../../components/ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CleaningStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningList'>;

export default function CleaningScreen(props: Props) {
  const { isTabletOrWider } = useBreakpoint();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (!isTabletOrWider) {
    return <CleaningListScreen {...props} />;
  }

  const list = (
    <CleaningListScreen
      {...props}
      onSelectTask={setSelectedTaskId}
      selectedTaskId={selectedTaskId}
    />
  );

  const detail = selectedTaskId ? (
    <CleaningTaskDetailScreen {...(props as any)} taskIdOverride={selectedTaskId} />
  ) : null;

  const empty = (
    <View style={styles.empty}>
      <EmptyState
        icon="broom"
        title="Выберите задачу"
        subtitle="Тапните задачу слева, чтобы открыть чек-лист уборки."
      />
    </View>
  );

  return <SplitView list={list} detail={detail} emptyDetail={empty} />;
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', padding: 24 },
});
