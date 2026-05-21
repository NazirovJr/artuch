import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  BookingGroup,
  addGroupCharge,
  addGroupPayment,
  addRoomToGroup,
  cancelBookingGroup,
  closeBookingGroup,
  getBookingGroup,
  removeRoomFromGroup,
} from '../../api/booking-groups';
import { getRooms } from '../../api/rooms';
import type { RoomsStackParamList } from '../../navigation/types';
import { maskDate } from '../../utils/inputMask';

type Props = NativeStackScreenProps<
  RoomsStackParamList,
  'BookingGroupDetail'
>;

export default function BookingGroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const theme = useTheme();
  const [group, setGroup] = useState<BookingGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [pickedRoom, setPickedRoom] = useState<any | null>(null);
  const [roomGuests, setRoomGuests] = useState('1');
  const [roomCheckIn, setRoomCheckIn] = useState('');
  const [roomCheckOut, setRoomCheckOut] = useState('');

  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const g = await getBookingGroup(groupId);
      setGroup(g);
      setRoomCheckIn(g.checkInDate ?? '');
      setRoomCheckOut(g.checkOutDate ?? '');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить группу');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [groupId, navigation]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getRooms();
      // Filter out rooms already in this group + only show currently
      // available (not occupied / maintenance) ones.
      const inGroup = new Set(
        group?.reservations?.map((r) => r.roomNumber) ?? [],
      );
      setRooms(
        (data as any[]).filter(
          (r) => !inGroup.has(r.number) && r.status === 'available',
        ),
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить комнаты');
    }
  }, [group?.reservations]);

  const totalAmount = Number(group?.masterFolio?.totalAmount ?? 0);
  const paidAmount = Number(group?.masterFolio?.paidAmount ?? 0);
  const balance = totalAmount - paidAmount;
  const isOpen =
    group?.status === 'pending' || group?.status === 'active';
  const totalGuests = useMemo(
    () =>
      group?.reservations?.reduce(
        (s, r) => s + (Number(r.numberOfGuests) || 0),
        0,
      ) ?? 0,
    [group?.reservations],
  );

  const handleAddRoom = async () => {
    if (!pickedRoom) return;
    setBusy(true);
    try {
      await addRoomToGroup(groupId, {
        roomNumber: pickedRoom.number,
        numberOfGuests: Number(roomGuests) || 1,
        checkInDate: roomCheckIn || undefined,
        checkOutDate: roomCheckOut || undefined,
      });
      setAddRoomOpen(false);
      setPickedRoom(null);
      setRoomGuests('1');
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось добавить комнату');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveRoom = (reservationId: string, roomNumber: number) => {
    Alert.alert(
      'Убрать из группы?',
      `Комната ${roomNumber} перестанет относиться к группе. Бронь не удаляется.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Убрать',
          onPress: async () => {
            try {
              await removeRoomFromGroup(groupId, reservationId);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось');
            }
          },
        },
      ],
    );
  };

  const handleAddCharge = async () => {
    if (!chargeAmount || !chargeDesc.trim()) return;
    setBusy(true);
    try {
      await addGroupCharge(groupId, {
        amount: Number(chargeAmount),
        description: chargeDesc.trim(),
      });
      setChargeOpen(false);
      setChargeAmount('');
      setChargeDesc('');
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось добавить расход');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount) return;
    setBusy(true);
    try {
      await addGroupPayment(groupId, {
        amount: Number(paymentAmount),
        description: paymentDesc.trim() || undefined,
      });
      setPaymentOpen(false);
      setPaymentAmount('');
      setPaymentDesc('');
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось зафиксировать оплату');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    Alert.alert(
      'Закрыть группу и счёт?',
      'Все брони должны быть выселены или отменены. Master folio закроется.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть',
          onPress: async () => {
            try {
              await closeBookingGroup(groupId);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось закрыть');
            }
          },
        },
      ],
    );
  };

  const handleCancel = async () => {
    const activeCount = (group?.reservations ?? []).filter((r) =>
      ['pending', 'confirmed'].includes(r.status),
    ).length;

    const buttons: any[] = [{ text: 'Назад', style: 'cancel' }];

    const runCancel = async (cascade: boolean) => {
      try {
        await cancelBookingGroup(groupId, { cascade });
        await load();
      } catch (e: any) {
        Alert.alert('Ошибка', e.message || 'Не удалось отменить');
      }
    };

    if (activeCount > 0) {
      buttons.push({
        text: `Отменить группу + ${activeCount} брон.`,
        style: 'destructive',
        onPress: () => runCancel(true),
      });
    } else {
      buttons.push({
        text: 'Отменить',
        style: 'destructive',
        onPress: () => runCancel(false),
      });
    }

    Alert.alert(
      'Отменить группу?',
      activeCount > 0
        ? `В группе ${activeCount} активных брони. Они тоже будут отменены.`
        : 'Группа будет помечена отменённой.',
      buttons,
    );
  };

  if (loading || !group) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <ScrollView contentContainerStyle={styles.body}>
        {/* Header */}
        <Card mode="outlined" style={styles.card}>
          <Card.Title
            title={group.name}
            subtitle={`${group.code} · ${group.status}`}
            right={(props) =>
              // Card.Title clones whatever this returns and spreads its own
              // props onto it. Returning a boolean (`isOpen && <IconButton/>`)
              // ends up in cloneElement(false, …), which surfaces as
              // "Invalid prop `compact` supplied to React.Fragment". Always
              // return a valid element or null.
              isOpen ? (
                <IconButton
                  {...props}
                  icon="pencil"
                  onPress={() =>
                    navigation.navigate('BookingGroupForm', {
                      groupId: group.id,
                    })
                  }
                />
              ) : null
            }
          />
          <Card.Content>
            {(group.checkInDate || group.checkOutDate) && (
              <Text variant="bodySmall" style={styles.aux}>
                {group.checkInDate} — {group.checkOutDate}
              </Text>
            )}
            {(group.contactName || group.organization) && (
              <Text variant="bodySmall" style={styles.aux}>
                {group.organization && `${group.organization} · `}
                {group.contactName}
                {group.contactPhone && ` · ${group.contactPhone}`}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Chip compact style={styles.metaChip}>
                {group.reservations?.length ?? 0} комн.
              </Chip>
              <Chip compact style={styles.metaChip}>
                {totalGuests} гостей
              </Chip>
              {Number(group.discountPercent) > 0 && (
                <Chip compact style={styles.metaChip}>
                  −{group.discountPercent}%
                </Chip>
              )}
              {group.routeAllToMaster && (
                <Chip compact style={styles.metaChip}>
                  Один счёт
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Bill summary */}
        <Card
          mode="outlined"
          style={[styles.card, styles.billCard]}
        >
          <Card.Content>
            <Text variant="labelMedium">Master folio</Text>
            <View style={styles.billRow}>
              <View style={styles.billCol}>
                <Text variant="labelSmall" style={styles.billLabel}>
                  Начислено
                </Text>
                <Text variant="titleLarge">{totalAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.billCol}>
                <Text variant="labelSmall" style={styles.billLabel}>
                  Оплачено
                </Text>
                <Text variant="titleLarge">{paidAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.billCol}>
                <Text variant="labelSmall" style={styles.billLabel}>
                  Долг
                </Text>
                <Text
                  variant="titleLarge"
                  style={{
                    color:
                      balance > 0
                        ? theme.colors.error
                        : theme.colors.primary,
                  }}
                >
                  {balance.toFixed(2)}
                </Text>
              </View>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button
              icon="printer"
              onPress={() =>
                navigation.navigate('BookingGroupStatement', { groupId })
              }
            >
              Печать / PDF
            </Button>
            {/* Card.Actions clones each direct child and forwards `mode`/
                `compact` props onto it. A Fragment wrapper (`<>...</>`)
                catches those props itself and surfaces the React 19
                warning "Invalid prop `compact` supplied to React.Fragment".
                Keep each conditional Button as its own JSX expression. */}
            {isOpen && (
              <Button
                icon="cash-plus"
                onPress={() => setChargeOpen(true)}
              >
                Добавить расход
              </Button>
            )}
            {isOpen && (
              <Button
                icon="cash-check"
                mode="contained"
                onPress={() => setPaymentOpen(true)}
                disabled={balance <= 0}
              >
                Принять оплату
              </Button>
            )}
          </Card.Actions>
        </Card>

        {/* Rooms list */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium">Комнаты</Text>
            {isOpen && (
              <Button
                compact
                icon="plus"
                onPress={() => {
                  loadRooms();
                  setAddRoomOpen(true);
                }}
              >
                Добавить
              </Button>
            )}
          </View>
          {(group.reservations ?? []).length === 0 ? (
            <EmptyState
              icon="bed-empty"
              title="Нет комнат в группе"
              actionLabel={isOpen ? 'Добавить первую' : undefined}
            />
          ) : (
            (group.reservations ?? []).map((r) => (
              <Card key={r.id} mode="outlined" style={styles.roomCard}>
                <Card.Title
                  title={`№ ${r.roomNumber}`}
                  subtitle={`${r.checkInDate} — ${r.checkOutDate} · ${r.numberOfGuests} гостей`}
                  right={(props) =>
                    isOpen ? (
                      <IconButton
                        {...props}
                        icon="link-off"
                        onPress={() => handleRemoveRoom(r.id, r.roomNumber)}
                      />
                    ) : null
                  }
                />
                <Card.Content>
                  <View style={styles.roomMetaRow}>
                    <Chip compact>{r.status}</Chip>
                    <Chip compact icon="cash">
                      {Number(r.totalPrice).toFixed(0)}
                    </Chip>
                    {r.guest && (
                      <Chip compact icon="account">
                        {r.guest.firstName} {r.guest.lastName}
                      </Chip>
                    )}
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </View>

        {/* Final actions */}
        {isOpen && (
          <View style={styles.finalActions}>
            <Button
              mode="outlined"
              onPress={handleCancel}
              textColor={theme.colors.error}
              style={styles.flex}
            >
              Отменить группу
            </Button>
            <Button
              mode="contained"
              onPress={handleClose}
              style={styles.flex}
              disabled={balance > 0}
            >
              Закрыть
            </Button>
          </View>
        )}
        {balance > 0 && isOpen && (
          <Text variant="labelSmall" style={styles.balanceWarn}>
            Закрытие невозможно пока есть остаток к оплате.
          </Text>
        )}
      </ScrollView>

      {/* Add room dialog */}
      <Portal>
        <Dialog
          visible={addRoomOpen}
          onDismiss={() => setAddRoomOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Добавить комнату</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              <Text variant="labelMedium" style={styles.label}>
                Свободная комната
              </Text>
              <View style={styles.chipRow}>
                {rooms.map((r) => (
                  <Chip
                    key={r.number}
                    selected={pickedRoom?.number === r.number}
                    onPress={() => setPickedRoom(r)}
                    showSelectedCheck={false}
                    style={styles.roomChip}
                  >
                    {r.number} · {r.type ?? r.roomType?.name}
                  </Chip>
                ))}
                {rooms.length === 0 && (
                  <Text variant="bodySmall" style={styles.help}>
                    Нет свободных комнат
                  </Text>
                )}
              </View>
              <TextInput
                mode="outlined"
                label="Гостей"
                keyboardType="number-pad"
                value={roomGuests}
                onChangeText={setRoomGuests}
                style={styles.input}
              />
              <View style={styles.row}>
                <TextInput
                  mode="outlined"
                  label="Заезд (опц.)"
                  value={roomCheckIn}
                  onChangeText={(v) => setRoomCheckIn(maskDate(v))}
                  placeholder={group.checkInDate ?? 'YYYY-MM-DD'}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={10}
                  style={[styles.input, styles.flex]}
                />
                <TextInput
                  mode="outlined"
                  label="Выезд (опц.)"
                  value={roomCheckOut}
                  onChangeText={(v) => setRoomCheckOut(maskDate(v))}
                  placeholder={group.checkOutDate ?? 'YYYY-MM-DD'}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={10}
                  style={[styles.input, styles.flex]}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddRoomOpen(false)}>Отмена</Button>
            <Button
              onPress={handleAddRoom}
              loading={busy}
              disabled={!pickedRoom || busy}
            >
              Добавить
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Charge dialog */}
        <Dialog
          visible={chargeOpen}
          onDismiss={() => setChargeOpen(false)}
        >
          <Dialog.Title>Расход группы</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Описание"
              value={chargeDesc}
              onChangeText={setChargeDesc}
              placeholder="Welcome dinner / трансфер / экскурсия"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Сумма"
              keyboardType="decimal-pad"
              value={chargeAmount}
              onChangeText={setChargeAmount}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setChargeOpen(false)}>Отмена</Button>
            <Button
              onPress={handleAddCharge}
              loading={busy}
              disabled={!chargeAmount || !chargeDesc.trim() || busy}
            >
              Добавить
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Payment dialog */}
        <Dialog
          visible={paymentOpen}
          onDismiss={() => setPaymentOpen(false)}
        >
          <Dialog.Title>Оплата группы</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Сумма"
              keyboardType="decimal-pad"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Описание (опц.)"
              value={paymentDesc}
              onChangeText={setPaymentDesc}
              placeholder="Наличные / карта / банк"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPaymentOpen(false)}>Отмена</Button>
            <Button
              onPress={handleAddPayment}
              loading={busy}
              disabled={!paymentAmount || busy}
            >
              Принять
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 12 },
  card: { marginBottom: 12 },
  billCard: {},
  aux: { opacity: 0.75, marginBottom: 4 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaChip: { alignSelf: 'flex-start' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  billCol: { alignItems: 'center', flex: 1 },
  billLabel: { opacity: 0.6, marginBottom: 4 },
  section: { marginTop: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomCard: { marginBottom: 8 },
  roomMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  finalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  flex: { flex: 1 },
  balanceWarn: { textAlign: 'center', marginTop: 8, opacity: 0.6 },
  dialog: { maxHeight: '85%' },
  dialogScroll: { paddingHorizontal: 0 },
  label: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chipBtn: { marginRight: 4, marginBottom: 4 },
  roomChip: { alignSelf: 'flex-start' },
  input: { marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  help: { opacity: 0.7, paddingVertical: 8 },
});
