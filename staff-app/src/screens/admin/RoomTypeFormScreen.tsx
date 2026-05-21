import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Chip,
  Divider,
  HelperText,
  IconButton,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  CreateRoomTypeData,
  RoomType,
  createRoomType,
  getRoomType,
  updateRoomType,
} from '../../api/room-types';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'RoomTypeForm'>;

const VIEW_OPTIONS = [
  { value: '', label: '—' },
  { value: 'mountain', label: 'Горы' },
  { value: 'garden', label: 'Сад' },
  { value: 'courtyard', label: 'Двор' },
  { value: 'street', label: 'Улица' },
  { value: 'pool', label: 'Бассейн' },
];

const KNOWN_AMENITIES = [
  { slug: 'wifi', label: 'Wi-Fi' },
  { slug: 'ac', label: 'Кондиционер' },
  { slug: 'heating', label: 'Отопление' },
  { slug: 'tv', label: 'TV' },
  { slug: 'minibar', label: 'Мини-бар' },
  { slug: 'safe', label: 'Сейф' },
  { slug: 'balcony', label: 'Балкон' },
  { slug: 'terrace', label: 'Терраса' },
  { slug: 'kettle', label: 'Чайник' },
  { slug: 'hairdryer', label: 'Фен' },
  { slug: 'iron', label: 'Утюг' },
  { slug: 'workspace', label: 'Раб. место' },
  { slug: 'fireplace', label: 'Камин' },
  { slug: 'jacuzzi', label: 'Джакузи' },
  { slug: 'kitchenette', label: 'Кухня-уголок' },
  { slug: 'parking', label: 'Парковка' },
];

interface FormState extends CreateRoomTypeData {}

const EMPTY: FormState = {
  code: '',
  name: '',
  basePrice: 0,
  amenities: [],
  photos: [],
};

export default function RoomTypeFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const editingId = route.params?.roomTypeId;
  const isEdit = !!editingId;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photoInput, setPhotoInput] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!editingId) return;
    try {
      const rt = await getRoomType(editingId);
      setForm({
        code: rt.code,
        name: rt.name,
        nameEn: rt.nameEn ?? undefined,
        description: rt.description ?? undefined,
        descriptionEn: rt.descriptionEn ?? undefined,
        maxGuests: rt.maxGuests,
        maxAdults: rt.maxAdults,
        maxChildren: rt.maxChildren,
        beds: rt.beds,
        bedConfiguration: rt.bedConfiguration ?? undefined,
        sizeM2: rt.sizeM2 ?? undefined,
        view: rt.view ?? undefined,
        basePrice: Number(rt.basePrice),
        weekendPrice: rt.weekendPrice ?? undefined,
        taxRate: rt.taxRate ?? undefined,
        taxIncluded: rt.taxIncluded,
        photos: rt.photos ?? [],
        coverPhoto: rt.coverPhoto ?? undefined,
        videoUrl: rt.videoUrl ?? undefined,
        amenities: rt.amenities ?? [],
        smokingAllowed: rt.smokingAllowed,
        petsAllowed: rt.petsAllowed,
        accessibleForDisabled: rt.accessibleForDisabled,
        childrenAllowed: rt.childrenAllowed,
        breakfastIncluded: rt.breakfastIncluded,
        minStayNights: rt.minStayNights,
        maxStayNights: rt.maxStayNights,
        displayOrder: rt.displayOrder,
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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const toggleAmenity = (slug: string) => {
    const list = form.amenities ?? [];
    set(
      'amenities',
      list.includes(slug) ? list.filter((a) => a !== slug) : [...list, slug],
    );
  };

  const addPhoto = () => {
    const url = photoInput.trim();
    if (!url) return;
    const photos = [...(form.photos ?? []), url];
    set('photos', photos);
    if (!form.coverPhoto) set('coverPhoto', url);
    setPhotoInput('');
  };

  const removePhoto = (idx: number) => {
    const photos = (form.photos ?? []).filter((_, i) => i !== idx);
    set('photos', photos);
    if (form.coverPhoto && (form.photos ?? [])[idx] === form.coverPhoto) {
      set('coverPhoto', photos[0] ?? undefined);
    }
  };

  const codeValid = isEdit || /^[a-z][a-z0-9-]*$/.test(form.code);
  const canSave =
    !saving &&
    codeValid &&
    form.name.trim().length > 0 &&
    Number(form.basePrice) >= 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { ...form } as any;
      // Strip empty optional fields the backend treats as "unchanged".
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });
      if (isEdit) {
        delete payload.code; // immutable on update
        await updateRoomType(editingId!, payload);
      } else {
        await createRoomType(payload);
      }
      navigation.goBack();
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
        <Text variant="titleLarge" style={styles.section}>
          Основное
        </Text>
        <TextInput
          mode="outlined"
          label="Код (slug)"
          value={form.code}
          onChangeText={(v) => set('code', v.toLowerCase())}
          autoCapitalize="none"
          disabled={isEdit}
          error={!isEdit && form.code.length > 0 && !codeValid}
          style={styles.input}
        />
        {!isEdit && form.code && !codeValid && (
          <HelperText type="error" visible>
            Только латинские строчные, цифры и дефисы
          </HelperText>
        )}
        <TextInput
          mode="outlined"
          label="Название (RU)"
          value={form.name}
          onChangeText={(v) => set('name', v)}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Название (EN)"
          value={form.nameEn ?? ''}
          onChangeText={(v) => set('nameEn', v)}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Описание (RU)"
          value={form.description ?? ''}
          onChangeText={(v) => set('description', v)}
          multiline
          numberOfLines={4}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Описание (EN)"
          value={form.descriptionEn ?? ''}
          onChangeText={(v) => set('descriptionEn', v)}
          multiline
          numberOfLines={4}
          style={styles.input}
        />

        <Divider style={styles.divider} />
        <Text variant="titleLarge" style={styles.section}>
          Вместимость и спальные места
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Гостей max"
            value={String(form.maxGuests ?? '')}
            onChangeText={(v) => set('maxGuests', Number(v) || undefined)}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            mode="outlined"
            label="Взрослых"
            value={String(form.maxAdults ?? '')}
            onChangeText={(v) => set('maxAdults', Number(v) || undefined)}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            mode="outlined"
            label="Детей"
            value={String(form.maxChildren ?? '')}
            onChangeText={(v) => set('maxChildren', Number(v) || undefined)}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Кроватей"
            value={String(form.beds ?? '')}
            onChangeText={(v) => set('beds', Number(v) || undefined)}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            mode="outlined"
            label="Конфигурация"
            value={form.bedConfiguration ?? ''}
            onChangeText={(v) => set('bedConfiguration', v)}
            placeholder="1 king + 1 sofa"
            style={[styles.input, styles.flex2]}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Площадь (m²)"
            value={String(form.sizeM2 ?? '')}
            onChangeText={(v) => set('sizeM2', Number(v) || undefined)}
            keyboardType="decimal-pad"
            style={[styles.input, styles.flex]}
          />
        </View>
        <Text variant="labelMedium" style={styles.label}>
          Вид из окна
        </Text>
        <SegmentedButtons
          value={form.view ?? ''}
          onValueChange={(v) => set('view', v || undefined)}
          buttons={VIEW_OPTIONS}
          style={styles.segmented}
          density="small"
        />

        <Divider style={styles.divider} />
        <Text variant="titleLarge" style={styles.section}>
          Цены
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Базовая цена"
            value={String(form.basePrice ?? '')}
            onChangeText={(v) => set('basePrice', Number(v) || 0)}
            keyboardType="decimal-pad"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            mode="outlined"
            label="Цена в выходные"
            value={String(form.weekendPrice ?? '')}
            onChangeText={(v) => set('weekendPrice', Number(v) || undefined)}
            keyboardType="decimal-pad"
            style={[styles.input, styles.flex]}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="НДС, %"
            value={String(form.taxRate ?? '')}
            onChangeText={(v) => set('taxRate', Number(v) || undefined)}
            keyboardType="decimal-pad"
            style={[styles.input, styles.flex]}
          />
          <View style={[styles.toggleRow, styles.flex]}>
            <Text>В цене</Text>
            <Switch
              value={form.taxIncluded ?? true}
              onValueChange={(v) => set('taxIncluded', v)}
            />
          </View>
        </View>

        <Divider style={styles.divider} />
        <Text variant="titleLarge" style={styles.section}>
          Медиа
        </Text>
        <Text variant="bodySmall" style={styles.help}>
          Вставьте URL фото и нажмите «Добавить». Первое фото становится
          обложкой; тапните по миниатюре чтобы сменить обложку.
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="URL фото"
            value={photoInput}
            onChangeText={setPhotoInput}
            autoCapitalize="none"
            style={[styles.input, styles.flex2]}
          />
          <Button
            mode="contained"
            onPress={addPhoto}
            disabled={!photoInput.trim()}
            style={styles.addBtn}
          >
            Добавить
          </Button>
        </View>
        {form.photos && form.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoStrip}>
              {form.photos.map((url, i) => {
                const isCover = url === form.coverPhoto;
                return (
                  <TouchableOpacity
                    key={`${url}-${i}`}
                    onPress={() => set('coverPhoto', url)}
                    style={[
                      styles.photoBox,
                      isCover && {
                        borderColor: theme.colors.primary,
                        borderWidth: 3,
                      },
                    ]}
                  >
                    <Image source={{ uri: url }} style={styles.photoImg} />
                    <IconButton
                      icon="close"
                      size={16}
                      style={styles.photoRemove}
                      onPress={() => removePhoto(i)}
                    />
                    {isCover && (
                      <View
                        style={[
                          styles.coverBadge,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      >
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.onPrimary }}
                        >
                          Обложка
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
        <TextInput
          mode="outlined"
          label="URL видео (YouTube/Vimeo/MP4)"
          value={form.videoUrl ?? ''}
          onChangeText={(v) => set('videoUrl', v)}
          autoCapitalize="none"
          style={styles.input}
        />

        <Divider style={styles.divider} />
        <Text variant="titleLarge" style={styles.section}>
          Что включено
        </Text>
        <View style={styles.amenityRow}>
          {KNOWN_AMENITIES.map((a) => {
            const selected = (form.amenities ?? []).includes(a.slug);
            return (
              <Chip
                key={a.slug}
                compact
                selected={selected}
                onPress={() => toggleAmenity(a.slug)}
                style={styles.amenityChip}
              >
                {a.label}
              </Chip>
            );
          })}
        </View>

        <Divider style={styles.divider} />
        <Text variant="titleLarge" style={styles.section}>
          Правила
        </Text>
        <View style={styles.toggleRow}>
          <Text>Завтрак включён</Text>
          <Switch
            value={!!form.breakfastIncluded}
            onValueChange={(v) => set('breakfastIncluded', v)}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text>Курение разрешено</Text>
          <Switch
            value={!!form.smokingAllowed}
            onValueChange={(v) => set('smokingAllowed', v)}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text>С животными</Text>
          <Switch
            value={!!form.petsAllowed}
            onValueChange={(v) => set('petsAllowed', v)}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text>Доступно МГН</Text>
          <Switch
            value={!!form.accessibleForDisabled}
            onValueChange={(v) => set('accessibleForDisabled', v)}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text>Дети разрешены</Text>
          <Switch
            value={form.childrenAllowed !== false}
            onValueChange={(v) => set('childrenAllowed', v)}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Min ночей"
            value={String(form.minStayNights ?? '')}
            onChangeText={(v) => set('minStayNights', Number(v) || undefined)}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
          />
          <TextInput
            mode="outlined"
            label="Max ночей"
            value={String(form.maxStayNights ?? '')}
            onChangeText={(v) => set('maxStayNights', Number(v) || undefined)}
            keyboardType="number-pad"
            style={[styles.input, styles.flex]}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Порядок отображения"
          value={String(form.displayOrder ?? '')}
          onChangeText={(v) => set('displayOrder', Number(v) || undefined)}
          keyboardType="number-pad"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
          style={styles.submit}
        >
          {isEdit ? 'Сохранить' : 'Создать тип'}
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 64, gap: 4 },
  section: { fontWeight: '600', marginVertical: 8 },
  divider: { marginVertical: 16 },
  input: { marginBottom: 10 },
  label: { marginBottom: 6, marginTop: 6 },
  segmented: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  help: { opacity: 0.7, marginBottom: 8 },
  addBtn: { marginTop: 6 },
  photoStrip: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  photoBox: {
    width: 120,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -8, right: -8, margin: 0 },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenityChip: { marginRight: 4, marginBottom: 4 },
  submit: { marginTop: 24 },
});
