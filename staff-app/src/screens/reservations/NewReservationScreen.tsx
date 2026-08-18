import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme, Divider } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { getRooms } from '../../api/rooms';
import { createGuest, getGuests } from '../../api/guests';
import {
  checkReservationConflicts,
  createReservation,
} from '../../api/reservations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  FormDateInput,
  FormNumberInput,
  FormSelect,
  FormTextInput,
} from '../../components/form';
import {
  newReservationSchema,
  type NewReservationForm,
  type NewReservationInput,
} from '../../schemas/reservation';
import { guestSchema, type GuestForm } from '../../schemas/guest';
import { maskPhone } from '../../utils/inputMask';

type Props = NativeStackScreenProps<RoomsStackParamList, 'NewReservation'>;

// Two type params because guestSchema uses `preprocess` (input is
// `unknown`, output is the typed shape) — mirrors GuestFormScreen's setup.
type GuestFormInput = z.input<typeof guestSchema>;

export default function NewReservationScreen({ navigation }: Props) {
  const theme = useTheme();

  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [creatingGuest, setCreatingGuest] = useState(false);

  const { control, handleSubmit, formState, watch, setValue } = useForm<
    NewReservationInput,
    any,
    NewReservationForm
  >({
    resolver: zodResolver(newReservationSchema),
    mode: 'onTouched',
    defaultValues: {
      guestId: '',
      roomNumber: undefined,
      checkInDate: undefined,
      checkOutDate: undefined,
      numberOfGuests: 1,
      notes: '',
    },
  });

  // Separate RHF instance for the "new guest" dialog — deliberately not
  // nested under the reservation form above (different field names, no
  // collision risk) so a guest can be created without losing whatever
  // room/dates/notes were already filled in on the reservation itself.
  const {
    control: guestControl,
    handleSubmit: handleGuestSubmit,
    formState: guestFormState,
    reset: resetGuestForm,
  } = useForm<GuestFormInput, any, GuestForm>({
    resolver: zodResolver(guestSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      passportNumber: '',
      phone: '',
      email: '',
      nationality: '',
    },
  });

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [guestData, roomData] = await Promise.all([getGuests(), getRooms()]);
      setGuests(guestData);
      setRooms(roomData.filter((r: any) => r.status === 'available'));
    } catch {
      // handle error silently
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
  }, [navigation, fetchData]);

  const watchedRoomNumber = watch('roomNumber');
  const watchedCheckIn = watch('checkInDate');
  const watchedCheckOut = watch('checkOutDate');

  const selectedRoom = rooms.find((r: any) => r.number === watchedRoomNumber);
  const nights =
    watchedCheckIn && watchedCheckOut
      ? Math.ceil(
          (watchedCheckOut.getTime() - watchedCheckIn.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;
  const totalPrice = selectedRoom && nights > 0
    ? nights * Number(selectedRoom.pricePerNight || 0)
    : 0;

  // Live conflict check whenever room/dates change. Server is the source
  // of truth — we just surface what it would refuse before submit.
  useEffect(() => {
    let cancelled = false;
    if (!watchedRoomNumber || !watchedCheckIn || !watchedCheckOut || nights <= 0) {
      setConflicts([]);
      return;
    }
    setCheckingConflicts(true);
    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    checkReservationConflicts({
      roomNumber: watchedRoomNumber,
      from: fmt(watchedCheckIn),
      to: fmt(watchedCheckOut),
    })
      .then((rows) => {
        if (!cancelled) setConflicts(rows || []);
      })
      .catch(() => {
        if (!cancelled) setConflicts([]);
      })
      .finally(() => {
        if (!cancelled) setCheckingConflicts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedRoomNumber, watchedCheckIn, watchedCheckOut, nights]);

  const onSubmit = async (data: NewReservationForm) => {
    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    try {
      await createReservation({
        guestId: data.guestId,
        roomNumber: data.roomNumber,
        checkInDate: fmt(data.checkInDate),
        checkOutDate: fmt(data.checkOutDate),
        numberOfGuests: data.numberOfGuests,
        notes: data.notes,
        totalPrice,
      });
      Alert.alert('Успешно', 'Бронирование создано', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать бронирование');
    }
  };

  // Creates the guest inline (no navigation away from this screen, so
  // whatever's already filled in above survives) and immediately selects
  // them in the reservation's "Гость" field — no need to re-open the
  // picker and hunt for the name that was just typed in.
  const handleCreateGuest = async (data: GuestForm) => {
    setCreatingGuest(true);
    try {
      const newGuest = await createGuest(data);
      setGuests((list) => [newGuest, ...list]);
      setValue('guestId', newGuest.id, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      setGuestDialogOpen(false);
      resetGuestForm();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать гостя');
    } finally {
      setCreatingGuest(false);
    }
  };

  if (loadingData) {
    return (
      <ScreenContainer maxWidth="reading">
        <View style={[styles.container, styles.center]}>
          <Text>Загрузка...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container}>
        <View style={styles.form}>
          {guests.length === 0 && (
            // Without this banner the form just looks broken: tapping
            // "Выберите гостя" opens an empty Menu, the submit stays
            // disabled, and there's no obvious way to add a guest from
            // here. Opens the same inline dialog as the button below —
            // doesn't navigate away, so nothing already filled in is lost.
            <View style={styles.noticeCard}>
              <Text variant="titleSmall" style={styles.noticeTitle}>
                Сначала добавьте гостя
              </Text>
              <Text variant="bodySmall" style={styles.noticeBody}>
                В системе ещё нет ни одного гостя — без этого нельзя
                создать бронирование.
              </Text>
              <Button
                mode="contained"
                icon="account-plus"
                onPress={() => setGuestDialogOpen(true)}
                style={styles.noticeBtn}
              >
                Добавить гостя
              </Button>
            </View>
          )}
          <FormSelect
            control={control}
            name="guestId"
            label="Гость *"
            placeholder="Выберите гостя"
            options={guests.map((g) => ({
              value: g.id,
              label: `${g.firstName} ${g.lastName}`,
            }))}
          />
          {/* Always available, not just on an empty list — the guest
              you're looking for not being there yet is the common case,
              not just the "brand-new system" one. */}
          <Button
            mode="text"
            icon="account-plus"
            compact
            onPress={() => setGuestDialogOpen(true)}
            style={styles.addGuestBtn}
          >
            Гостя нет в списке — добавить нового
          </Button>

          <FormSelect
            control={control}
            name="roomNumber"
            label="Номер *"
            placeholder="Выберите номер"
            options={rooms.map((r) => ({
              value: String(r.number),
              label: `#${r.number} — ${r.type} (${r.pricePerNight} TJS/ночь)`,
            }))}
          />

          <FormDateInput
            control={control}
            name="checkInDate"
            label="Дата заезда *"
            minDate={today}
          />

          <FormDateInput
            control={control}
            name="checkOutDate"
            label="Дата выезда *"
            minDate={watchedCheckIn ?? today}
          />

          <FormNumberInput
            control={control}
            name="numberOfGuests"
            label="Количество гостей"
          />

          <FormTextInput
            control={control}
            name="notes"
            label="Заметки"
            multiline
            numberOfLines={3}
          />

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <View style={styles.conflictCard}>
              <Text variant="titleSmall" style={styles.conflictTitle}>
                ⚠️ Конфликт с существующими бронями
              </Text>
              {conflicts.map((c) => (
                <Text key={c.id} variant="bodySmall" style={styles.conflictItem}>
                  {c.checkInDate?.slice(0, 10)} → {c.checkOutDate?.slice(0, 10)}
                  {c.guest ? ` · ${c.guest.firstName} ${c.guest.lastName}` : ''}
                </Text>
              ))}
            </View>
          )}

          {/* Price calculation */}
          {nights > 0 && selectedRoom && (
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text variant="bodyMedium">Ночей:</Text>
                <Text variant="bodyMedium">{nights}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text variant="bodyMedium">Цена за ночь:</Text>
                <Text variant="bodyMedium">{selectedRoom.pricePerNight} TJS</Text>
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={styles.priceRow}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                  Итого:
                </Text>
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: 'bold', color: theme.colors.primary }}
                >
                  {totalPrice} TJS
                </Text>
              </View>
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting || checkingConflicts}
            disabled={
              formState.isSubmitting ||
              checkingConflicts ||
              conflicts.length > 0 ||
              !formState.isValid
            }
            style={styles.submitButton}
            icon="check"
          >
            Создать бронирование
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={guestDialogOpen}
          onDismiss={() => setGuestDialogOpen(false)}
          style={styles.guestDialog}
        >
          <Dialog.Title>Новый гость</Dialog.Title>
          <Dialog.ScrollArea style={styles.guestDialogScroll}>
            <ScrollView contentContainerStyle={styles.guestDialogContent}>
              <FormTextInput control={guestControl} name="firstName" label="Имя *" />
              <FormTextInput control={guestControl} name="lastName" label="Фамилия *" />
              <FormTextInput
                control={guestControl}
                name="passportNumber"
                label="Номер паспорта"
              />
              <FormTextInput
                control={guestControl}
                name="phone"
                label="Телефон"
                keyboardType="phone-pad"
                mask={maskPhone}
              />
              <FormTextInput
                control={guestControl}
                name="email"
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <FormTextInput control={guestControl} name="nationality" label="Гражданство" />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setGuestDialogOpen(false)}>Отмена</Button>
            <Button
              onPress={handleGuestSubmit(handleCreateGuest)}
              loading={creatingGuest}
              disabled={creatingGuest || !guestFormState.isValid}
            >
              Создать
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  priceCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  submitButton: { marginTop: 8, borderRadius: 8 },
  conflictCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  conflictTitle: { color: '#991B1B', fontWeight: 'bold', marginBottom: 6 },
  conflictItem: { color: '#7F1D1D' },
  noticeCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  noticeTitle: { color: '#92400E', fontWeight: 'bold' },
  noticeBody: { color: '#92400E' },
  noticeBtn: { alignSelf: 'flex-start', marginTop: 4 },
  addGuestBtn: { alignSelf: 'flex-start', marginTop: -8, marginBottom: 12 },
  guestDialog: { maxHeight: '85%' },
  guestDialogScroll: { paddingHorizontal: 0 },
  guestDialogContent: { paddingHorizontal: 24 },
});
