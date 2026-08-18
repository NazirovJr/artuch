import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  HelperText,
  IconButton,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  CreateBookingGroupData,
  GroupChargeType,
  addGroupCharge,
  addRoomToGroup,
  createBookingGroup,
  getBookingGroup,
  updateBookingGroup,
} from '../../api/booking-groups';
import { getRooms } from '../../api/rooms';
import type { RoomsStackParamList } from '../../navigation/types';
import {
  maskDate,
  maskMoney,
  maskPhone,
  moneyInputFilter,
  unmaskMoney,
} from '../../utils/inputMask';

type Props = NativeStackScreenProps<RoomsStackParamList, 'BookingGroupForm'>;

// A room or service picked while assembling the group, before the group
// (and therefore its id) exists. Held in local state and flushed to the
// API right after creation — see handleSave — so reception can build the
// whole group (info + rooms + services) in one screen instead of creating
// it, then re-opening BookingGroupDetail just to attach rooms.
interface PendingRoom {
  tempId: string;
  roomNumber: number;
  roomLabel: string;
  numberOfGuests: number;
  checkInDate?: string;
  checkOutDate?: string;
}

interface PendingCharge {
  tempId: string;
  description: string;
  amount: number;
  chargeType: GroupChargeType;
}

// Mirrors backend GROUP_CHARGE_TYPES (booking-group.dto.ts) minus the
// server-only 'payment'/'refund'/'room' types.
const GROUP_CHARGE_TYPES: GroupChargeType[] = [
  'service',
  'restaurant',
  'bar',
  'shop',
  'rental',
  'discount',
];

const CHARGE_TYPE_LABEL: Record<GroupChargeType, string> = {
  restaurant: 'Ресторан',
  bar: 'Бар',
  shop: 'Магазин',
  rental: 'Прокат',
  service: 'Услуга',
  discount: 'Скидка',
};

export default function BookingGroupFormScreen({ route, navigation }: Props) {
  const editingId = route.params?.groupId;
  const isEdit = !!editingId;
  const [form, setForm] = useState<CreateBookingGroupData>({
    name: '',
    routeAllToMaster: true,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  // Set once createBookingGroup succeeds and stays set across retries, so
  // tapping "Сохранить" again after a partial failure flushes the
  // remaining pending rooms/services onto the SAME group instead of
  // creating a second one.
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  // ─── Rooms & services composer (create mode only) ────────────────
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [pendingRooms, setPendingRooms] = useState<PendingRoom[]>([]);
  const [pickedRoom, setPickedRoom] = useState<any | null>(null);
  const [roomGuests, setRoomGuests] = useState('1');
  const [roomCheckIn, setRoomCheckIn] = useState('');
  const [roomCheckOut, setRoomCheckOut] = useState('');

  const [pendingCharges, setPendingCharges] = useState<PendingCharge[]>([]);
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeType, setChargeType] = useState<GroupChargeType>('service');

  useEffect(() => {
    if (isEdit) return; // composer only shown (and needed) when creating
    (async () => {
      setLoadingRooms(true);
      try {
        const data = await getRooms();
        setRooms((data as any[]).filter((r) => r.status === 'available'));
      } catch {
        // Non-fatal: the picker just shows no rooms; group creation itself
        // doesn't depend on this list.
      } finally {
        setLoadingRooms(false);
      }
    })();
  }, [isEdit]);

  const load = useCallback(async () => {
    if (!editingId) return;
    try {
      const g = await getBookingGroup(editingId);
      setForm({
        name: g.name,
        leaderGuestId: g.leaderGuestId ?? undefined,
        contactName: g.contactName ?? undefined,
        contactPhone: g.contactPhone ?? undefined,
        contactEmail: g.contactEmail ?? undefined,
        organization: g.organization ?? undefined,
        checkInDate: g.checkInDate ?? undefined,
        checkOutDate: g.checkOutDate ?? undefined,
        discountPercent:
          g.discountPercent != null ? Number(g.discountPercent) : undefined,
        notes: g.notes ?? undefined,
        routeAllToMaster: g.routeAllToMaster,
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [editingId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof CreateBookingGroupData>(
    key: K,
    value: CreateBookingGroupData[K],
  ) => setForm((s) => ({ ...s, [key]: value }));

  const canSave = !saving && form.name.trim().length > 0;

  const availableRoomsForPicking = useMemo(
    () => rooms.filter((r) => !pendingRooms.some((p) => p.roomNumber === r.number)),
    [rooms, pendingRooms],
  );
  const effectiveRoomCheckIn = roomCheckIn || form.checkInDate || '';
  const effectiveRoomCheckOut = roomCheckOut || form.checkOutDate || '';
  const hasRoomDates = !!effectiveRoomCheckIn && !!effectiveRoomCheckOut;
  // Plain string comparison is enough here: maskDate always produces
  // zero-padded YYYY-MM-DD, which sorts lexicographically the same as it
  // sorts chronologically. Catching a reversed range client-side avoids a
  // preventable round trip — the backend rejects it too (booking-groups
  // .service.ts), but only after the group has already been created.
  const roomDatesInOrder = !hasRoomDates || effectiveRoomCheckIn < effectiveRoomCheckOut;
  const canAddRoom = !!pickedRoom && hasRoomDates && roomDatesInOrder;
  const canAddCharge =
    chargeDesc.trim().length > 0 && Number(unmaskMoney(chargeAmount)) > 0;

  const handleAddPendingRoom = () => {
    if (!canAddRoom || !pickedRoom) return;
    setPendingRooms((list) => [
      ...list,
      {
        tempId: `${pickedRoom.number}-${list.length}-${Date.now()}`,
        roomNumber: pickedRoom.number,
        roomLabel: `№ ${pickedRoom.number} · ${pickedRoom.type ?? pickedRoom.roomType?.name ?? ''}`,
        // Math.max guards against negative input, too — `|| 1` alone only
        // catches 0/NaN and would let e.g. "-2" through as a truthy number.
        numberOfGuests: Math.max(1, Number(roomGuests) || 1),
        checkInDate: roomCheckIn || undefined,
        checkOutDate: roomCheckOut || undefined,
      },
    ]);
    setPickedRoom(null);
    setRoomGuests('1');
    setRoomCheckIn('');
    setRoomCheckOut('');
  };

  const handleRemovePendingRoom = (tempId: string) =>
    setPendingRooms((list) => list.filter((r) => r.tempId !== tempId));

  const handleAddPendingCharge = () => {
    const amount = Number(unmaskMoney(chargeAmount));
    if (!chargeDesc.trim() || !amount) return;
    setPendingCharges((list) => [
      ...list,
      {
        tempId: `c-${list.length}-${Date.now()}`,
        description: chargeDesc.trim(),
        amount,
        chargeType,
      },
    ]);
    setChargeDesc('');
    setChargeAmount('');
    setChargeType('service');
  };

  const handleRemovePendingCharge = (tempId: string) =>
    setPendingCharges((list) => list.filter((c) => c.tempId !== tempId));

  const buildGroupPayload = () => {
    const payload = { ...form };
    Object.keys(payload).forEach((k) => {
      const v = (payload as any)[k];
      if (v === '' || v === undefined) delete (payload as any)[k];
    });
    return payload;
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateBookingGroup(editingId!, buildGroupPayload());
        navigation.goBack();
        return;
      }

      // Create the group itself only once. `createdGroupId` persists
      // across retries, so re-tapping "Сохранить" after a partial failure
      // flushes only the leftover rooms/charges below instead of creating
      // a second group for the same booking.
      let groupId = createdGroupId;
      let groupName = form.name;
      if (!groupId) {
        const created = await createBookingGroup(buildGroupPayload());
        groupId = created.id;
        groupName = created.name;
        setCreatedGroupId(created.id);
      }

      // Flush every room/service picked while assembling the group.
      // Rooms are independent inserts — different room numbers, and
      // addRoom never read-modify-writes any shared group-level state for
      // a 'confirmed' reservation (that only happens at check-in) — so
      // they run concurrently. Charges post to the group's single shared
      // master folio and must stay sequential: FoliosService.recalculate
      // does read-all-then-overwrite-total, and two concurrent posts can
      // race and silently drop one from the total.
      const failures: string[] = [];

      // Snapshot which tempIds are actually being attempted in this call —
      // the composer's "Добавить" buttons aren't disabled while saving, so
      // the operator can queue another room/charge mid-flight. Filtering
      // pending state down to "not attempted" and "not attempted" alone
      // (below) keeps anything added after this snapshot untouched.
      const attemptedRoomIds = new Set(pendingRooms.map((r) => r.tempId));
      const attemptedChargeIds = new Set(pendingCharges.map((c) => c.tempId));

      const roomOutcomes = await Promise.allSettled(
        pendingRooms.map((r) =>
          addRoomToGroup(groupId as string, {
            roomNumber: r.roomNumber,
            numberOfGuests: r.numberOfGuests,
            checkInDate: r.checkInDate,
            checkOutDate: r.checkOutDate,
          }),
        ),
      );
      const failedRoomIds = new Set<string>();
      roomOutcomes.forEach((outcome, i) => {
        if (outcome.status === 'rejected') {
          const r = pendingRooms[i];
          failedRoomIds.add(r.tempId);
          failures.push(`Комната ${r.roomNumber}: ${outcome.reason?.message || 'ошибка'}`);
        }
      });

      const failedChargeIds = new Set<string>();
      for (const c of pendingCharges) {
        try {
          await addGroupCharge(groupId, {
            description: c.description,
            amount: c.amount,
            chargeType: c.chargeType,
          });
        } catch (e: any) {
          failedChargeIds.add(c.tempId);
          failures.push(`«${c.description}»: ${e.message || 'ошибка'}`);
        }
      }

      // Only drop what was attempted AND succeeded. Anything that failed
      // stays in the composer, fully filled in, ready to retry with one
      // more tap instead of being retyped from memory on
      // BookingGroupDetail; anything queued after the snapshot above
      // (added while this save was still in flight) is left alone too.
      setPendingRooms((list) =>
        list.filter((r) => !attemptedRoomIds.has(r.tempId) || failedRoomIds.has(r.tempId)),
      );
      setPendingCharges((list) =>
        list.filter((c) => !attemptedChargeIds.has(c.tempId) || failedChargeIds.has(c.tempId)),
      );

      if (failures.length > 0) {
        Alert.alert(
          'Часть позиций не добавилась',
          `Группа "${groupName}" создана. Не удалось добавить:\n${failures.join('\n')}\n\nИсправьте и нажмите "Сохранить" ещё раз, либо откройте группу и добавьте вручную.`,
          [
            { text: 'Остаться и исправить', style: 'cancel' },
            {
              text: 'Открыть группу',
              onPress: () =>
                navigation.replace('BookingGroupDetail', { groupId: groupId as string }),
            },
          ],
        );
        return;
      }

      navigation.replace('BookingGroupDetail', { groupId });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ScreenContainer maxWidth="reading" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <Text variant="titleMedium" style={styles.section}>
          Основное
        </Text>
        <TextInput
          mode="outlined"
          label="Название группы"
          value={form.name}
          onChangeText={(v) => set('name', v)}
          placeholder='Семья Smith / "ACME Q4 trip"'
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Организация (опц.)"
          value={form.organization ?? ''}
          onChangeText={(v) => set('organization', v)}
          style={styles.input}
        />

        <Text variant="titleMedium" style={styles.section}>
          Контакт
        </Text>
        <TextInput
          mode="outlined"
          label="Имя"
          value={form.contactName ?? ''}
          onChangeText={(v) => set('contactName', v)}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Телефон"
          value={form.contactPhone ?? ''}
          onChangeText={(v) => set('contactPhone', maskPhone(v))}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Email"
          value={form.contactEmail ?? ''}
          onChangeText={(v) => set('contactEmail', v)}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text variant="titleMedium" style={styles.section}>
          Даты
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Заезд (YYYY-MM-DD)"
            value={form.checkInDate ?? ''}
            onChangeText={(v) => set('checkInDate', maskDate(v))}
            placeholder="2026-05-10"
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={10}
            style={[styles.input, styles.flex]}
          />
          <TextInput
            mode="outlined"
            label="Выезд"
            value={form.checkOutDate ?? ''}
            onChangeText={(v) => set('checkOutDate', maskDate(v))}
            placeholder="2026-05-15"
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={10}
            style={[styles.input, styles.flex]}
          />
        </View>
        <HelperText type="info" visible style={styles.helper}>
          Эти даты подставятся для каждой комнаты по умолчанию. Можно
          переопределить при добавлении конкретной комнаты.
        </HelperText>

        {!isEdit && (
          <View style={styles.composerBlock}>
            <Text variant="titleMedium" style={styles.section}>
              Комнаты
            </Text>
            <HelperText type="info" visible style={styles.helper}>
              Добавьте комнаты сейчас — не придётся заново открывать
              созданную группу, чтобы их прикрепить.
            </HelperText>

            {pendingRooms.length > 0 && (
              <View style={styles.pendingList}>
                {pendingRooms.map((r) => (
                  <View key={r.tempId} style={styles.pendingRow}>
                    <View style={styles.pendingInfo}>
                      <Text variant="bodyMedium">{r.roomLabel}</Text>
                      <Text variant="bodySmall" style={styles.help}>
                        {r.checkInDate || form.checkInDate || '—'} —{' '}
                        {r.checkOutDate || form.checkOutDate || '—'} ·{' '}
                        {r.numberOfGuests} гостей
                      </Text>
                    </View>
                    <IconButton
                      icon="close"
                      size={18}
                      onPress={() => handleRemovePendingRoom(r.tempId)}
                    />
                  </View>
                ))}
              </View>
            )}

            <View style={styles.chipRow}>
              {availableRoomsForPicking.map((r) => (
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
              {!loadingRooms && availableRoomsForPicking.length === 0 && (
                <Text variant="bodySmall" style={styles.help}>
                  Нет свободных комнат
                </Text>
              )}
            </View>

            {pickedRoom && (
              <>
                <View style={styles.row}>
                  <TextInput
                    mode="outlined"
                    label="Заезд (опц.)"
                    value={roomCheckIn}
                    onChangeText={(v) => setRoomCheckIn(maskDate(v))}
                    placeholder={form.checkInDate || 'YYYY-MM-DD'}
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
                    placeholder={form.checkOutDate || 'YYYY-MM-DD'}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    maxLength={10}
                    style={[styles.input, styles.flex]}
                  />
                </View>
                <TextInput
                  mode="outlined"
                  label="Гостей"
                  keyboardType="number-pad"
                  value={roomGuests}
                  onChangeText={setRoomGuests}
                  style={styles.input}
                />
                <Button
                  mode="outlined"
                  icon="plus"
                  onPress={handleAddPendingRoom}
                  disabled={!canAddRoom}
                  style={styles.addBtn}
                >
                  Добавить комнату в группу
                </Button>
                {!canAddRoom && (
                  <HelperText type="error" visible style={styles.helper}>
                    {!hasRoomDates
                      ? 'Укажите даты заезда и выезда — у группы выше или у этой комнаты'
                      : 'Дата выезда должна быть позже даты заезда'}
                  </HelperText>
                )}
              </>
            )}
          </View>
        )}

        <Text variant="titleMedium" style={styles.section}>
          Цены и счёт
        </Text>
        <TextInput
          mode="outlined"
          label="Скидка группе, %"
          value={
            form.discountPercent != null ? String(form.discountPercent) : ''
          }
          onChangeText={(v) => set('discountPercent', v ? Number(v) : undefined)}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <HelperText type="info" visible style={styles.helper}>
          Скидка применяется к ставке номера при добавлении комнаты в
          группу. Зафиксируется в totalPrice брони.
        </HelperText>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text variant="bodyLarge">Один общий счёт</Text>
            <Text variant="bodySmall" style={styles.help}>
              Все room-charges и POS уйдут на master folio группы.
              Выключите если каждый платит сам за себя.
            </Text>
          </View>
          <Switch
            value={form.routeAllToMaster ?? true}
            onValueChange={(v) => set('routeAllToMaster', v)}
          />
        </View>

        {!isEdit && (
          <View style={styles.composerBlock}>
            <Text variant="titleMedium" style={styles.section}>
              Услуги
            </Text>
            <HelperText type="info" visible style={styles.helper}>
              Разовые начисления на счёт группы — трансфер, экскурсия,
              welcome dinner. Можно добавить и позже со страницы группы.
            </HelperText>

            {pendingCharges.length > 0 && (
              <View style={styles.pendingList}>
                {pendingCharges.map((c) => (
                  <View key={c.tempId} style={styles.pendingRow}>
                    <View style={styles.pendingInfo}>
                      <Text variant="bodyMedium">{c.description}</Text>
                      <Text variant="bodySmall" style={styles.help}>
                        {c.amount.toFixed(2)} TJS · {CHARGE_TYPE_LABEL[c.chargeType]}
                      </Text>
                    </View>
                    <IconButton
                      icon="close"
                      size={18}
                      onPress={() => handleRemovePendingCharge(c.tempId)}
                    />
                  </View>
                ))}
              </View>
            )}

            <TextInput
              mode="outlined"
              label="Описание"
              value={chargeDesc}
              onChangeText={setChargeDesc}
              placeholder="Трансфер аэропорт — отель"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Сумма"
              keyboardType="decimal-pad"
              value={chargeAmount}
              onChangeText={(v) => setChargeAmount(moneyInputFilter(v))}
              onBlur={() => setChargeAmount((v) => maskMoney(v))}
              style={styles.input}
            />
            <View style={styles.chipRow}>
              {GROUP_CHARGE_TYPES.map((t) => (
                <Chip
                  key={t}
                  selected={chargeType === t}
                  onPress={() => setChargeType(t)}
                  showSelectedCheck={false}
                  style={styles.roomChip}
                >
                  {CHARGE_TYPE_LABEL[t]}
                </Chip>
              ))}
            </View>
            <Button
              mode="outlined"
              icon="plus"
              onPress={handleAddPendingCharge}
              disabled={!canAddCharge}
              style={styles.addBtn}
            >
              Добавить услугу
            </Button>
          </View>
        )}

        <Text variant="titleMedium" style={styles.section}>
          Примечания
        </Text>
        <TextInput
          mode="outlined"
          value={form.notes ?? ''}
          onChangeText={(v) => set('notes', v)}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        {createdGroupId && (pendingRooms.length > 0 || pendingCharges.length > 0) && (
          <HelperText type="error" visible style={styles.helper}>
            Группа уже создана. Ниже остались позиции, которые не
            добавились — исправьте и нажмите «Повторить», либо откройте
            группу и добавьте их вручную.
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
          style={styles.submit}
        >
          {isEdit ? 'Сохранить' : createdGroupId ? 'Повторить' : 'Создать группу'}
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 64, gap: 4 },
  section: { fontWeight: '600', marginTop: 12, marginBottom: 8 },
  input: { marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  helper: { paddingHorizontal: 0 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  toggleText: { flex: 1, gap: 4 },
  help: { opacity: 0.7 },
  submit: { marginTop: 24 },
  composerBlock: { marginBottom: 8 },
  pendingList: { marginBottom: 8, gap: 4 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    paddingLeft: 12,
  },
  pendingInfo: { flex: 1, gap: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  roomChip: { alignSelf: 'flex-start' },
  addBtn: { marginBottom: 4 },
});
