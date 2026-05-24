import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  SegmentedButtons,
  Switch,
  useTheme,
} from 'react-native-paper';
import { getMenuAdmin, createMenuItem, updateMenuItem } from '../../api/menu';
import { useToast } from '../../components/ui/Toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'MenuItemForm'>;

export default function MenuItemFormScreen({ route, navigation }: Props) {
  const itemId = route.params?.itemId;
  const theme = useTheme();
  const toast = useToast();
  const isEdit = !!itemId;

  const [nameRu, setNameRu] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [station, setStation] = useState('kitchen');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      try {
        const all = await getMenuAdmin();
        const item = all.find((i) => i.id === itemId);
        if (item) {
          setNameRu(item.nameRu || '');
          setName(item.name || '');
          setCategory(item.category || '');
          setStation(item.station || 'kitchen');
          setPrice(String(item.price ?? ''));
          setDescription(item.description || '');
          setIsActive(item.isActive !== false);
        }
      } catch {
        toast.show('Не удалось загрузить позицию', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId, toast]);

  const handleSave = async () => {
    const ru = nameRu.trim();
    const priceNum = Number(price);
    if (!ru) {
      toast.show('Укажите название', 'error');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.show('Укажите корректную цену', 'error');
      return;
    }
    const payload = {
      nameRu: ru,
      name: name.trim() || ru,
      category: category.trim() || 'other',
      station,
      price: priceNum,
      description: description.trim(),
      isActive,
    };
    setSaving(true);
    try {
      if (isEdit) await updateMenuItem(itemId!, payload);
      else await createMenuItem(payload);
      toast.show('Сохранено', 'success');
      navigation.goBack();
    } catch (e: any) {
      toast.show(e.message || 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Загрузка…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TextInput label="Название (рус.)" value={nameRu} onChangeText={setNameRu} mode="outlined" style={styles.input} />
        <TextInput label="Название (англ.)" value={name} onChangeText={setName} mode="outlined" style={styles.input} />
        <TextInput label="Категория" value={category} onChangeText={setCategory} mode="outlined" style={styles.input} placeholder="tajik / international / bar / service" />
        <TextInput label="Цена, TJS" value={price} onChangeText={setPrice} keyboardType="decimal-pad" mode="outlined" style={styles.input} />

        <Text variant="titleSmall" style={styles.label}>Станция (куда идёт позиция)</Text>
        <SegmentedButtons
          value={station}
          onValueChange={setStation}
          buttons={[
            { value: 'kitchen', label: 'Кухня', icon: 'pot-steam' },
            { value: 'bar', label: 'Бар', icon: 'glass-cocktail' },
            { value: 'none', label: 'Официант', icon: 'room-service-outline' },
          ]}
          style={styles.segments}
        />
        <Text variant="bodySmall" style={styles.hint}>
          «Официант» — без подготовки (хлеб, вода): не попадает на КДС, подаётся сразу.
        </Text>

        <TextInput label="Описание" value={description} onChangeText={setDescription} mode="outlined" multiline style={styles.input} />

        <View style={styles.switchRow}>
          <Text variant="bodyLarge">Активна (видна официантам)</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <Button mode="contained" loading={saving} disabled={saving} onPress={handleSave} style={styles.saveBtn}>
          {isEdit ? 'Сохранить' : 'Создать позицию'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 12 },
  input: { marginBottom: 12 },
  label: { marginBottom: 8, marginLeft: 4, opacity: 0.7 },
  segments: { marginBottom: 6 },
  hint: { opacity: 0.6, marginBottom: 12, marginHorizontal: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  footer: { padding: 12, borderTopWidth: 1 },
  saveBtn: { borderRadius: 8, paddingVertical: 4 },
});
