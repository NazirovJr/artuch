import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useToast } from '../../components/ui/Toast';
import { getSettings, updateSettings, type SystemSettings } from '../../api/settings';

type FieldKey = keyof Omit<SystemSettings, 'id' | 'updatedAt'>;

const FIELDS: { key: FieldKey; label: string; multiline?: boolean }[] = [
  { key: 'hotelName', label: 'Название отеля' },
  { key: 'hotelAddress', label: 'Адрес', multiline: true },
  { key: 'hotelPhone', label: 'Телефон' },
  { key: 'hotelEmail', label: 'Email' },
  { key: 'hotelWebsite', label: 'Сайт' },
  { key: 'hotelTaxId', label: 'ИНН / Налоговый №' },
  { key: 'currency', label: 'Валюта (например TJS, USD)' },
  { key: 'logoUrl', label: 'URL логотипа (или base64)', multiline: true },
];

export default function AdminSettingsScreen() {
  const theme = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<FieldKey, string>>({
    hotelName: '', hotelAddress: '', hotelPhone: '',
    hotelEmail: '', hotelWebsite: '', hotelTaxId: '',
    currency: 'TJS', logoUrl: '',
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getSettings();
      setForm({
        hotelName: s.hotelName ?? '',
        hotelAddress: s.hotelAddress ?? '',
        hotelPhone: s.hotelPhone ?? '',
        hotelEmail: s.hotelEmail ?? '',
        hotelWebsite: s.hotelWebsite ?? '',
        hotelTaxId: s.hotelTaxId ?? '',
        currency: s.currency ?? 'TJS',
        logoUrl: s.logoUrl ?? '',
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<Omit<SystemSettings, 'id' | 'updatedAt'>> = {};
      for (const f of FIELDS) {
        (payload as any)[f.key] = form[f.key] || null;
      }
      await updateSettings(payload);
      toast.show('Настройки сохранены', 'success');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ScreenContainer><ActivityIndicator style={{ marginTop: 40 }} /></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          Данные отображаются в накладных, квитанциях и PDF-документах.
        </Text>

        {FIELDS.map((f) => (
          <TextInput
            key={f.key}
            label={f.label}
            value={form[f.key]}
            onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
            mode="outlined"
            multiline={f.multiline}
            numberOfLines={f.multiline ? 3 : 1}
            style={styles.input}
          />
        ))}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
          icon="content-save"
        >
          Сохранить
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  hint: { marginBottom: 16, lineHeight: 18 },
  input: { marginBottom: 12 },
  saveBtn: { marginTop: 8, borderRadius: 8 },
});
