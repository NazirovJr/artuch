import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  CreateBookingGroupData,
  createBookingGroup,
  getBookingGroup,
  updateBookingGroup,
} from '../../api/booking-groups';
import type { RoomsStackParamList } from '../../navigation/types';
import { maskDate, maskPhone, maskMoney, moneyInputFilter } from '../../utils/inputMask';

type Props = NativeStackScreenProps<RoomsStackParamList, 'BookingGroupForm'>;

export default function BookingGroupFormScreen({ route, navigation }: Props) {
  const editingId = route.params?.groupId;
  const isEdit = !!editingId;
  const [form, setForm] = useState<CreateBookingGroupData>({
    name: '',
    routeAllToMaster: true,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        const v = (payload as any)[k];
        if (v === '' || v === undefined) delete (payload as any)[k];
      });
      if (isEdit) {
        await updateBookingGroup(editingId!, payload);
        navigation.goBack();
      } else {
        const created = await createBookingGroup(payload);
        navigation.replace('BookingGroupDetail', { groupId: created.id });
      }
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

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
          style={styles.submit}
        >
          {isEdit ? 'Сохранить' : 'Создать группу'}
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
});
