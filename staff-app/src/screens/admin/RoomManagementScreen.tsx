import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  IconButton,
  Portal,
  SegmentedButtons,
  Searchbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  Room,
  RoomType,
  deleteRoom,
  getRoomTypes,
  updateRoomDetails,
} from '../../api/room-types';
import { getRooms } from '../../api/rooms';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'RoomManagement'>;
type Filter = 'all' | 'active' | 'inactive';

export default function RoomManagementScreen({ navigation }: Props) {
  const theme = useTheme();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');

  // Edit dialog state
  const [editing, setEditing] = useState<Room | null>(null);
  const [editTypeId, setEditTypeId] = useState<string | undefined>();
  const [editFloor, setEditFloor] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, t] = await Promise.all([getRooms(), getRoomTypes(true)]);
      setRooms(r as Room[]);
      setTypes(t);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const typeMap = useMemo(
    () => new Map(types.map((t) => [t.id, t])),
    [types],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filter === 'active' && !r.isActive) return false;
      if (filter === 'inactive' && r.isActive) return false;
      if (!q) return true;
      const matchesNumber = String(r.number).includes(q);
      const matchesType = (
        typeMap.get(r.roomTypeId ?? '')?.name ??
        r.type ??
        ''
      )
        .toLowerCase()
        .includes(q);
      const matchesLocation = (r.location ?? '').toLowerCase().includes(q);
      return matchesNumber || matchesType || matchesLocation;
    });
  }, [rooms, search, filter, typeMap]);

  const openEdit = (room: Room) => {
    setEditing(room);
    setEditTypeId(room.roomTypeId ?? undefined);
    setEditFloor(room.floor != null ? String(room.floor) : '');
    setEditLocation(room.location ?? '');
    setEditNotes(room.notes ?? '');
    setEditIsActive(room.isActive);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateRoomDetails(editing.number, {
        roomTypeId: editTypeId,
        floor: editFloor ? Number(editFloor) : undefined,
        location: editLocation.trim() || undefined,
        notes: editNotes.trim() || undefined,
        isActive: editIsActive,
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (room: Room) => {
    Alert.alert(
      'Удалить комнату?',
      `Комната ${room.number} удалится навсегда. Если есть бронирования — операция не пройдёт; используйте "Деактивировать" вместо.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoom(room.number);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось удалить');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Room }) => {
    const typeRow = item.roomTypeId ? typeMap.get(item.roomTypeId) : undefined;
    return (
      <Card
        mode="outlined"
        style={[styles.card, !item.isActive && { opacity: 0.55 }]}
        onPress={() => openEdit(item)}
      >
        <Card.Title
          title={`№ ${item.number}`}
          subtitle={typeRow?.name ?? item.type ?? '—'}
          right={(props) => (
            <View style={styles.actionsRow}>
              <IconButton
                {...props}
                icon="pencil"
                onPress={() => openEdit(item)}
              />
              <IconButton
                {...props}
                icon="delete"
                onPress={() => handleDelete(item)}
              />
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.metaRow}>
            <Chip compact icon="bed">{item.beds}</Chip>
            <Chip compact icon="account-multiple">{item.maxGuests}</Chip>
            <Chip compact>{item.pricePerNight}/сут</Chip>
            {item.floor != null && (
              <Chip compact icon="stairs">эт. {item.floor}</Chip>
            )}
            {item.status && item.status !== 'available' && (
              <Chip compact>{item.status}</Chip>
            )}
            {!item.isActive && (
              <Chip compact icon="archive">Неактивна</Chip>
            )}
          </View>
          {item.location && (
            <Text variant="bodySmall" style={styles.aux}>
              {item.location}
            </Text>
          )}
          {item.notes && (
            <Text variant="bodySmall" style={styles.aux}>
              {item.notes}
            </Text>
          )}
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
        <Searchbar
          placeholder="Номер, тип, расположение"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          buttons={[
            { value: 'active', label: 'Активные' },
            { value: 'inactive', label: 'Неактивные' },
            { value: 'all', label: 'Все' },
          ]}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.number)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="bed-empty" title="Нет комнат" />
        }
      />
      <FAB
        icon="plus"
        label="Добавить"
        style={styles.fab}
        onPress={() => navigation.navigate('RoomForm', {})}
      />

      <Portal>
        <Dialog
          visible={!!editing}
          onDismiss={() => setEditing(null)}
          style={styles.dialog}
        >
          <Dialog.Title>
            Комната № {editing?.number}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="labelMedium" style={styles.label}>
              Тип
            </Text>
            <View style={styles.chipRow}>
              {types
                .filter((t) => t.isActive || t.id === editTypeId)
                .map((t) => (
                  <Button
                    key={t.id}
                    compact
                    mode={editTypeId === t.id ? 'contained' : 'outlined'}
                    onPress={() => setEditTypeId(t.id)}
                    style={styles.chipBtn}
                  >
                    {t.name}
                  </Button>
                ))}
            </View>
            <TextInput
              mode="outlined"
              label="Этаж"
              keyboardType="number-pad"
              value={editFloor}
              onChangeText={setEditFloor}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Расположение"
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Корпус A, угловая"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Примечания"
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={2}
              style={styles.input}
            />
            <View style={styles.toggleRow}>
              <Text>Активная</Text>
              <Switch value={editIsActive} onValueChange={setEditIsActive} />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)}>Отмена</Button>
            <Button
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            >
              Сохранить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, gap: 8 },
  search: { backgroundColor: 'transparent' },
  list: { paddingHorizontal: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  actionsRow: { flexDirection: 'row' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aux: { marginTop: 4, opacity: 0.7 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  dialog: { maxHeight: '85%' },
  label: { marginBottom: 6 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chipBtn: { marginRight: 4, marginBottom: 4 },
  input: { marginBottom: 10 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
