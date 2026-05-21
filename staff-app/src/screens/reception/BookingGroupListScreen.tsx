import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Card,
  Chip,
  FAB,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  BookingGroup,
  BookingGroupStatus,
  getBookingGroups,
} from '../../api/booking-groups';
import type { RoomsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RoomsStackParamList, 'BookingGroupList'>;
type Tab = 'open' | 'closed' | 'all';

const STATUS_LABEL: Record<BookingGroupStatus, string> = {
  pending: 'Ожидает',
  active: 'Активна',
  closed: 'Закрыта',
  cancelled: 'Отменена',
};

export default function BookingGroupListScreen({ navigation }: Props) {
  const theme = useTheme();
  const [groups, setGroups] = useState<BookingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('open');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBookingGroups();
      setGroups(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить группы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const filtered = groups.filter((g) => {
    if (tab === 'open') {
      return g.status === 'pending' || g.status === 'active';
    }
    if (tab === 'closed') {
      return g.status === 'closed' || g.status === 'cancelled';
    }
    return true;
  });

  const renderItem = ({ item }: { item: BookingGroup }) => {
    const total = item.masterFolio?.totalAmount ?? 0;
    const paid = item.masterFolio?.paidAmount ?? 0;
    const balance = Number(total) - Number(paid);
    const rooms = item.reservations?.length ?? 0;
    const guests =
      item.reservations?.reduce(
        (s, r) => s + (Number(r.numberOfGuests) || 0),
        0,
      ) ?? 0;
    return (
      <Card
        mode="outlined"
        style={styles.card}
        onPress={() =>
          navigation.navigate('BookingGroupDetail', { groupId: item.id })
        }
      >
        <Card.Title
          title={item.name}
          subtitle={`${item.code} · ${rooms} комн. · ${guests} гостей`}
          right={() => (
            <Chip
              compact
              style={[
                styles.statusChip,
                {
                  backgroundColor:
                    item.status === 'active'
                      ? theme.colors.primaryContainer
                      : item.status === 'closed'
                        ? theme.colors.surfaceVariant
                        : item.status === 'cancelled'
                          ? theme.colors.errorContainer
                          : theme.colors.tertiaryContainer,
                },
              ]}
            >
              {STATUS_LABEL[item.status]}
            </Chip>
          )}
        />
        <Card.Content>
          {(item.checkInDate || item.checkOutDate) && (
            <Text variant="bodySmall" style={styles.aux}>
              {item.checkInDate} — {item.checkOutDate}
            </Text>
          )}
          {(item.contactName || item.organization) && (
            <Text variant="bodySmall" style={styles.aux}>
              {item.organization && `${item.organization} · `}
              {item.contactName}
              {item.contactPhone && ` · ${item.contactPhone}`}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Chip compact icon="cash">
              Счёт: {Number(total).toFixed(0)}
            </Chip>
            <Chip
              compact
              icon={balance > 0 ? 'alert' : 'check'}
              style={{
                backgroundColor:
                  balance > 0
                    ? theme.colors.errorContainer
                    : theme.colors.surfaceVariant,
              }}
            >
              {balance > 0 ? `Долг: ${balance.toFixed(0)}` : 'Оплачено'}
            </Chip>
            {item.discountPercent != null &&
              Number(item.discountPercent) > 0 && (
                <Chip compact icon="percent">
                  −{item.discountPercent}%
                </Chip>
              )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'open', label: 'Активные' },
            { value: 'closed', label: 'Завершённые' },
            { value: 'all', label: 'Все' },
          ]}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(g) => g.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="account-group"
            title="Нет групп"
            actionLabel="Создать первую"
          />
        }
      />
      <FAB
        icon="plus"
        label="Новая группа"
        style={styles.fab}
        onPress={() => navigation.navigate('BookingGroupForm', {})}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12 },
  list: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  statusChip: { marginRight: 8 },
  aux: { marginBottom: 4, opacity: 0.75 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
