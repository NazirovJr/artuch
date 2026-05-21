import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
  Button,
  Card,
  Text,
  TextInput,
  RadioButton,
  Divider,
  useTheme,
} from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRoomStore } from '../../store/roomStore';
import { getRooms } from '../../api/rooms';
import { getGuests } from '../../api/guests';
import { createReservation } from '../../api/reservations';
import { RoomType, getRoomType } from '../../api/room-types';
import RoomTypeInfoCard from '../../components/RoomTypeInfoCard';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormDateInput, FormNumberInput, FormTextInput } from '../../components/form';
import {
  newReservationSchema,
  type NewReservationForm,
  type NewReservationInput,
} from '../../schemas/reservation';

interface Props {
  preselectedRoom?: any;
  onBack: () => void;
  onDone: () => void;
  onCreateGuest: () => void;
}

const formatISODate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function CheckInScreen({
  preselectedRoom,
  onBack,
  onDone,
  onCreateGuest,
}: Props) {
  const theme = useTheme();
  const { rooms, guests, setRooms, setGuests } = useRoomStore();
  const [guestSearch, setGuestSearch] = useState('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Guest/room selection happens through scrollable lists below — RHF
  // tracks the selected ids/numbers via `setValue` so validation stays
  // consistent with the rest of the form.
  const { control, handleSubmit, formState, setValue, watch } = useForm<
    NewReservationInput,
    any,
    NewReservationForm
  >({
    resolver: zodResolver(newReservationSchema),
    mode: 'onTouched',
    defaultValues: {
      guestId: '',
      roomNumber: preselectedRoom?.number,
      checkInDate: today,
      checkOutDate: undefined,
      numberOfGuests: 1,
      notes: '',
    },
  });

  const watchedGuestId = watch('guestId');
  const watchedRoomNumber = watch('roomNumber');
  const watchedCheckIn = watch('checkInDate');
  const watchedCheckOut = watch('checkOutDate');

  const loadData = useCallback(async () => {
    try {
      const [roomsData, guestsData] = await Promise.all([getRooms(), getGuests()]);
      setRooms(roomsData);
      setGuests(guestsData);
    } catch {
      // Surface via the form's own error state if needed; silently retry on
      // next mount otherwise.
    }
  }, [setRooms, setGuests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableRooms = rooms.filter((r: any) => r.status === 'available');

  const filteredGuests = guestSearch
    ? guests.filter(
        (g: any) =>
          `${g.firstName} ${g.lastName}`.toLowerCase().includes(guestSearch.toLowerCase()) ||
          g.phone?.includes(guestSearch) ||
          g.passportNumber?.includes(guestSearch),
      )
    : guests;

  const selectedRoom = rooms.find((r: any) => r.number === watchedRoomNumber);
  const [roomType, setRoomType] = useState<RoomType | null>(null);

  // Pull RoomType details whenever the selected room changes — gives
  // reception the photo gallery + amenities + description to walk the
  // guest through during check-in.
  useEffect(() => {
    if (!selectedRoom) {
      setRoomType(null);
      return;
    }
    if (selectedRoom.roomType) {
      setRoomType(selectedRoom.roomType);
      return;
    }
    if (!selectedRoom.roomTypeId) {
      setRoomType(null);
      return;
    }
    let cancelled = false;
    getRoomType(selectedRoom.roomTypeId)
      .then((rt) => {
        if (!cancelled) setRoomType(rt);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedRoom]);
  const nights = watchedCheckIn && watchedCheckOut
    ? Math.ceil(
        (watchedCheckOut.getTime() - watchedCheckIn.getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const totalPrice = selectedRoom && nights > 0 ? nights * Number(selectedRoom.pricePerNight) : 0;

  const onSubmit = async (data: NewReservationForm) => {
    try {
      await createReservation({
        guestId: data.guestId,
        roomNumber: data.roomNumber,
        checkInDate: formatISODate(data.checkInDate),
        checkOutDate: formatISODate(data.checkOutDate),
        numberOfGuests: data.numberOfGuests,
        totalPrice,
        status: 'checked-in',
        actualCheckIn: new Date().toISOString(),
        notes: data.notes,
      });
      Alert.alert('Успешно', 'Гость заселён', [{ text: 'OK', onPress: onDone }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать бронирование');
    }
  };

  const renderGuestItem = ({ item }: { item: any }) => (
    <Card
      style={[
        styles.listItem,
        watchedGuestId === item.id && {
          borderColor: theme.colors.primary,
          borderWidth: 2,
        },
      ]}
      onPress={() => setValue('guestId', item.id, { shouldValidate: true, shouldTouch: true })}
    >
      <Card.Content style={styles.listItemContent}>
        <RadioButton
          value={item.id}
          status={watchedGuestId === item.id ? 'checked' : 'unchecked'}
          onPress={() =>
            setValue('guestId', item.id, { shouldValidate: true, shouldTouch: true })
          }
        />
        <View style={styles.guestInfo}>
          <Text variant="bodyLarge">
            {item.firstName} {item.lastName}
          </Text>
          {item.phone ? (
            <Text variant="bodySmall" style={styles.secondary}>
              {item.phone}
            </Text>
          ) : null}
          {item.passportNumber ? (
            <Text variant="bodySmall" style={styles.secondary}>
              Паспорт: {item.passportNumber}
            </Text>
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );

  const renderRoomItem = ({ item }: { item: any }) => (
    <Card
      style={[
        styles.listItem,
        watchedRoomNumber === item.number && {
          borderColor: theme.colors.primary,
          borderWidth: 2,
        },
      ]}
      onPress={() =>
        setValue('roomNumber', item.number, { shouldValidate: true, shouldTouch: true })
      }
    >
      <Card.Content style={styles.listItemContent}>
        <RadioButton
          value={String(item.number)}
          status={watchedRoomNumber === item.number ? 'checked' : 'unchecked'}
          onPress={() =>
            setValue('roomNumber', item.number, { shouldValidate: true, shouldTouch: true })
          }
        />
        <View style={styles.guestInfo}>
          <Text variant="bodyLarge">
            #{item.number} - {item.type}
          </Text>
          <Text variant="bodySmall" style={styles.secondary}>
            Кроватей: {item.beds} | {item.pricePerNight} TJS/ночь
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <ScreenContainer maxWidth="reading">
      <Button icon="arrow-left" onPress={onBack} style={styles.backButton}>
        Назад
      </Button>

      <Text variant="headlineMedium" style={styles.title}>
        Заселение
      </Text>

      {/* Guest selection */}
      <Card style={styles.section}>
        <Card.Title title="Выберите гостя" />
        <Card.Content>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Поиск гостя..."
              value={guestSearch}
              onChangeText={setGuestSearch}
              mode="outlined"
              style={styles.searchInput}
              dense
            />
            <Button mode="outlined" onPress={onCreateGuest} compact>
              + Новый
            </Button>
          </View>
          <FlatList
            data={filteredGuests}
            renderItem={renderGuestItem}
            keyExtractor={(item) => item.id}
            style={styles.innerList}
            nestedScrollEnabled
            ListEmptyComponent={<Text style={styles.emptyText}>Гости не найдены</Text>}
          />
        </Card.Content>
      </Card>

      {/* Room selection */}
      {!preselectedRoom && (
        <Card style={styles.section}>
          <Card.Title title="Выберите номер" />
          <Card.Content>
            <FlatList
              data={availableRooms}
              renderItem={renderRoomItem}
              keyExtractor={(item) => String(item.number)}
              style={styles.innerList}
              nestedScrollEnabled
              ListEmptyComponent={
                <Text style={styles.emptyText}>Нет свободных номеров</Text>
              }
            />
          </Card.Content>
        </Card>
      )}

      {preselectedRoom && (
        <Card style={styles.section}>
          <Card.Title title="Номер" />
          <Card.Content>
            <Text variant="bodyLarge">
              #{preselectedRoom.number} - {preselectedRoom.type} ({preselectedRoom.pricePerNight} TJS/ночь)
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Rich type summary — photos, description, amenities. Helps reception
          answer "what's included?" without leaving the screen. */}
      {roomType && (
        <View style={styles.section}>
          <RoomTypeInfoCard roomType={roomType} />
        </View>
      )}

      {/* Dates */}
      <Card style={styles.section}>
        <Card.Title title="Даты" />
        <Card.Content>
          <FormDateInput
            control={control}
            name="checkInDate"
            label="Дата заезда"
            minDate={today}
          />
          <FormDateInput
            control={control}
            name="checkOutDate"
            label="Дата выезда"
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
            numberOfLines={2}
          />
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={formState.isSubmitting}
        disabled={formState.isSubmitting || !formState.isValid}
        style={styles.confirmButton}
        icon="check"
      >
        Подтвердить заселение
      </Button>

      <View style={styles.bottomSpacer} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { alignSelf: 'flex-start', margin: 8 },
  title: { paddingHorizontal: 16, fontWeight: 'bold', marginBottom: 8 },
  section: { margin: 12, marginBottom: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchInput: { flex: 1 },
  innerList: { maxHeight: 200 },
  listItem: { marginVertical: 2 },
  listItemContent: { flexDirection: 'row', alignItems: 'center' },
  guestInfo: { flex: 1, marginLeft: 8 },
  secondary: { opacity: 0.6, marginTop: 2 },
  divider: { marginVertical: 8 },
  confirmButton: { marginHorizontal: 12, marginTop: 8 },
  emptyText: { textAlign: 'center', padding: 16, opacity: 0.5 },
  bottomSpacer: { height: 32 },
});
