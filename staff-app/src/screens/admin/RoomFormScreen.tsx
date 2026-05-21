import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  RoomType,
  bulkCreateRooms,
  createRoom,
  getRoomTypes,
} from '../../api/room-types';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'RoomForm'>;

type Mode = 'single' | 'bulk';

export default function RoomFormScreen({ route, navigation }: Props) {
  const presetTypeId = route.params?.roomTypeId;
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('single');

  const [roomTypeId, setRoomTypeId] = useState<string | undefined>(presetTypeId);
  // Free-form type label. Used only when `roomTypeId` is unset — lets the
  // user invent a type ("эконом-плюс", "семейный люкс") without first
  // creating a full RoomType record (beds/price/etc come from the fields
  // below). Chip pick → sets roomTypeId and clears this; typing here →
  // clears roomTypeId.
  const [customType, setCustomType] = useState('');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  // Spec fields used when type is custom (no RoomType to inherit from).
  const [beds, setBeds] = useState('1');
  const [maxGuests, setMaxGuests] = useState('2');
  const [pricePerNight, setPricePerNight] = useState('');

  // Bulk fields
  const [from, setFrom] = useState('');
  const [count, setCount] = useState('');

  const load = useCallback(async () => {
    try {
      const t = await getRoomTypes();
      setTypes(t.filter((x) => x.isActive));
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить типы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedType = useMemo(
    () => types.find((t) => t.id === roomTypeId),
    [types, roomTypeId],
  );

  const hasType = !!roomTypeId || customType.trim().length > 0;
  const canSaveSingle =
    hasType &&
    number.trim().length > 0 &&
    Number(number) > 0 &&
    !saving;
  const canSaveBulk =
    !!roomTypeId &&
    Number(from) > 0 &&
    Number(count) > 0 &&
    Number(count) <= 200 &&
    !saving;

  const handleSaveSingle = async () => {
    if (!canSaveSingle) return;
    setSaving(true);
    try {
      const isCustom = !roomTypeId;
      await createRoom({
        number: Number(number),
        // Either reuse an existing RoomType (cheaper, inherits specs) OR
        // pass a free-form `type` string with explicit beds/price/maxGuests.
        ...(isCustom
          ? {
              type: customType.trim().toLowerCase(),
              beds: beds ? Number(beds) : undefined,
              maxGuests: maxGuests ? Number(maxGuests) : undefined,
              pricePerNight: pricePerNight
                ? Number(pricePerNight)
                : undefined,
            }
          : { roomTypeId }),
        floor: floor ? Number(floor) : undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulk = async () => {
    if (!canSaveBulk || !roomTypeId) return;
    setSaving(true);
    try {
      const result = await bulkCreateRooms({
        roomTypeId,
        from: Number(from),
        count: Number(count),
        floor: floor ? Number(floor) : undefined,
      });
      Alert.alert(
        'Готово',
        `Создано: ${result.created.length}.${
          result.skipped.length
            ? ` Пропущено (уже существуют): ${result.skipped.join(', ')}`
            : ''
        }`,
      );
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ScreenContainer maxWidth="reading" loading skeletonCount={3} />;
  }

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: 'single', label: 'Одна комната' },
            { value: 'bulk', label: 'Несколько' },
          ]}
        />

        <Text variant="titleMedium" style={styles.label}>
          Тип
        </Text>
        {types.length > 0 && (
          <View style={styles.chipRow}>
            {types.map((t) => (
              <Chip
                key={t.id}
                compact
                selected={roomTypeId === t.id}
                onPress={() => {
                  setRoomTypeId(t.id);
                  setCustomType('');
                }}
                style={styles.chip}
              >
                {t.name}
              </Chip>
            ))}
          </View>
        )}
        {selectedType ? (
          <Card mode="outlined" style={styles.summaryCard}>
            <Card.Content>
              <Text variant="labelMedium">{selectedType.name}</Text>
              <Text variant="bodySmall">
                {selectedType.beds} кроватей · до {selectedType.maxGuests} гостей
                · {selectedType.basePrice}/сут
              </Text>
            </Card.Content>
          </Card>
        ) : (
          mode === 'single' && (
            <>
              <TextInput
                mode="outlined"
                label="Свой тип (например, эконом, люкс…)"
                value={customType}
                onChangeText={(v) => {
                  setCustomType(v);
                  if (v.trim()) setRoomTypeId(undefined);
                }}
                autoCapitalize="none"
                placeholder="economy, luxury, family…"
                style={styles.input}
              />
              {customType.trim().length > 0 && (
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text variant="labelSmall" style={styles.specLabel}>
                      Кроватей
                    </Text>
                    <TextInput
                      mode="outlined"
                      keyboardType="number-pad"
                      value={beds}
                      onChangeText={setBeds}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="labelSmall" style={styles.specLabel}>
                      Гостей макс.
                    </Text>
                    <TextInput
                      mode="outlined"
                      keyboardType="number-pad"
                      value={maxGuests}
                      onChangeText={setMaxGuests}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="labelSmall" style={styles.specLabel}>
                      Цена/сут
                    </Text>
                    <TextInput
                      mode="outlined"
                      keyboardType="decimal-pad"
                      value={pricePerNight}
                      onChangeText={setPricePerNight}
                      placeholder="0"
                      style={styles.input}
                    />
                  </View>
                </View>
              )}
            </>
          )
        )}

        {mode === 'single' ? (
          <>
            <Text variant="titleMedium" style={styles.label}>
              Номер комнаты
            </Text>
            <TextInput
              mode="outlined"
              keyboardType="number-pad"
              value={number}
              onChangeText={setNumber}
              placeholder="101"
            />
            <HelperText type="info" visible style={styles.helper}>
              Используется как идентификатор. Должен быть уникальным.
            </HelperText>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="titleMedium" style={styles.label}>
                  Начиная с номера
                </Text>
                <TextInput
                  mode="outlined"
                  keyboardType="number-pad"
                  value={from}
                  onChangeText={setFrom}
                  placeholder="101"
                />
              </View>
              <View style={styles.flex}>
                <Text variant="titleMedium" style={styles.label}>
                  Количество
                </Text>
                <TextInput
                  mode="outlined"
                  keyboardType="number-pad"
                  value={count}
                  onChangeText={setCount}
                  placeholder="10"
                />
              </View>
            </View>
            <HelperText type="info" visible style={styles.helper}>
              Создадутся комнаты {from || '?'}…{from && count ? Number(from) + Number(count) - 1 : '?'}.
              Уже существующие будут пропущены.
            </HelperText>
          </>
        )}

        <Text variant="titleMedium" style={styles.label}>
          Этаж
        </Text>
        <TextInput
          mode="outlined"
          keyboardType="number-pad"
          value={floor}
          onChangeText={setFloor}
          placeholder="1"
        />

        {mode === 'single' && (
          <>
            <Text variant="titleMedium" style={styles.label}>
              Расположение
            </Text>
            <TextInput
              mode="outlined"
              value={location}
              onChangeText={setLocation}
              placeholder="Корпус A, угловая"
            />

            <Text variant="titleMedium" style={styles.label}>
              Примечания
            </Text>
            <TextInput
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </>
        )}

        <Button
          mode="contained"
          onPress={mode === 'single' ? handleSaveSingle : handleSaveBulk}
          loading={saving}
          disabled={mode === 'single' ? !canSaveSingle : !canSaveBulk}
          style={styles.submit}
        >
          {mode === 'single' ? 'Создать комнату' : `Создать ${count || 0} комнат`}
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 64, gap: 4 },
  label: { marginTop: 14, marginBottom: 6, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { marginRight: 4, marginBottom: 4 },
  summaryCard: { marginVertical: 8 },
  helper: { paddingHorizontal: 0 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  input: { marginBottom: 4 },
  specLabel: { marginTop: 4, marginBottom: 4, opacity: 0.7 },
  submit: { marginTop: 24 },
});
