import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Chip,
  SegmentedButtons,
  useTheme,
  Badge,
} from 'react-native-paper';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { listCleaningTasks, type CleaningTask } from '../../api/cleaning';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import { useSocketEvent } from '../../socket/useSocketEvent';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CleaningStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningList'> & {
  /** Master-detail mode: tap calls this instead of navigating. */
  onSelectTask?: (taskId: string) => void;
  selectedTaskId?: string | null;
};

type Tab = 'mine' | 'pending' | 'review' | 'all';

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'mine', label: 'Мои' },
  { value: 'pending', label: 'Свободные' },
  { value: 'review', label: 'На инспекции' },
  { value: 'all', label: 'Все' },
];

const TYPE_LABEL: Record<string, string> = {
  departure: 'После выезда',
  stayover: 'Текущая',
  deep: 'Генеральная',
  inspection: 'Инспекция',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  'in-progress': '#3B82F6',
  review: '#8B5CF6',
  done: '#10B981',
  skipped: '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ждёт',
  'in-progress': 'В работе',
  review: 'На инспекции',
  done: 'Готово',
  skipped: 'Пропущено',
};

export default function CleaningListScreen({
  navigation,
  onSelectTask,
  selectedTaskId,
}: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();
  const isSupervisor =
    user?.role === 'admin' ||
    user?.role === 'manager' ||
    user?.role === 'owner';

  const [tab, setTab] = useState<Tab>(isSupervisor ? 'review' : 'mine');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCleaningTasks();
      setTasks(data);
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить задачи', 'error');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => fetchTasks());
    return unsubscribe;
  }, [navigation, fetchTasks]);

  // Live updates: any cleaning event refreshes the visible list. Cheap because
  // the staff-app only ever shows a few dozen tasks at most.
  useSocketEvent('cleaningTask:created', () => fetchTasks());
  useSocketEvent('cleaningTask:assigned', () => fetchTasks());
  useSocketEvent('cleaningTask:statusChanged', () => fetchTasks());

  const filtered = useMemo(() => {
    switch (tab) {
      case 'mine':
        return tasks.filter(
          (t) =>
            t.assignedTo === user?.id &&
            t.status !== 'done' &&
            t.status !== 'skipped',
        );
      case 'pending':
        return tasks.filter((t) => t.status === 'pending' && !t.assignedTo);
      case 'review':
        return tasks.filter((t) => t.status === 'review');
      case 'all':
      default:
        return tasks;
    }
  }, [tasks, tab, user]);

  const counts = useMemo(
    () => ({
      mine: tasks.filter(
        (t) =>
          t.assignedTo === user?.id &&
          t.status !== 'done' &&
          t.status !== 'skipped',
      ).length,
      pending: tasks.filter((t) => t.status === 'pending' && !t.assignedTo)
        .length,
      review: tasks.filter((t) => t.status === 'review').length,
    }),
    [tasks, user],
  );

  const renderTask = ({ item, index }: { item: CleaningTask; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Card
        style={[
          styles.card,
          selectedTaskId === item.id && {
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        onPress={() => {
          // Inspection has a different action set than the worker's
          // checklist screen. In split-view mode we still route through
          // the side-panel, but inspection tasks for supervisors push
          // a real screen so the inspector can use camera/notes UI.
          if (item.status === 'review' && isSupervisor) {
            navigation.navigate('CleaningInspection', { taskId: item.id });
            return;
          }
          if (onSelectTask) onSelectTask(item.id);
          else navigation.navigate('CleaningTaskDetail', { taskId: item.id });
        }}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.roomNumber}>
                Номер #{item.roomNumber}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline, marginTop: 2 }}
              >
                {TYPE_LABEL[item.type] || item.type}
                {item.assignedToName ? ` • ${item.assignedToName}` : ''}
              </Text>
            </View>
            <Chip
              compact
              style={{ backgroundColor: STATUS_COLOR[item.status] || '#999' }}
              textStyle={{ color: '#fff', fontSize: 12 }}
            >
              {STATUS_LABEL[item.status] || item.status}
            </Chip>
          </View>
        </Card.Content>
      </Card>
    </Animated.View>
  );

  if (initialLoad && loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.tabsRow}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={TAB_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          density="small"
        />
      </View>

      <View style={styles.countersRow}>
        <View style={styles.counterChip}>
          <Text variant="labelSmall">Мои</Text>
          <Badge style={{ backgroundColor: theme.colors.primary }}>
            {counts.mine}
          </Badge>
        </View>
        <View style={styles.counterChip}>
          <Text variant="labelSmall">Свободные</Text>
          <Badge style={{ backgroundColor: '#F59E0B' }}>{counts.pending}</Badge>
        </View>
        <View style={styles.counterChip}>
          <Text variant="labelSmall">На инспекции</Text>
          <Badge style={{ backgroundColor: '#8B5CF6' }}>{counts.review}</Badge>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTasks} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="check-circle-outline"
              title="Нет задач"
              subtitle={
                tab === 'mine'
                  ? 'У вас нет назначенных задач'
                  : 'Все номера в порядке'
              }
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabsRow: { paddingHorizontal: 12, paddingTop: 12 },
  countersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  counterChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomNumber: { fontWeight: 'bold' },
});
