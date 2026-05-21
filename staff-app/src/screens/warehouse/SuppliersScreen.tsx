import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  IconButton,
  Portal,
  Searchbar,
  Text,
  TextInput,
} from 'react-native-paper';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  CreateSupplierData,
  Supplier,
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from '../../api/suppliers';
import { maskPhone } from '../../utils/inputMask';

export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateSupplierData>({ name: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSuppliers(true);
      setSuppliers(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson?.toLowerCase().includes(q) ?? false)
    );
  });

  const openDialog = (existing?: Supplier) => {
    setEditing(existing ?? null);
    setForm(
      existing
        ? {
            name: existing.name,
            contactPerson: existing.contactPerson ?? undefined,
            phone: existing.phone ?? undefined,
            email: existing.email ?? undefined,
            address: existing.address ?? undefined,
            notes: existing.notes ?? undefined,
          }
        : { name: '' },
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateSupplier(editing.id, form);
      } else {
        await createSupplier(form);
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: Supplier) => {
    Alert.alert('Деактивировать поставщика?', s.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Деактивировать',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSupplier(s.id);
            await load();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Supplier }) => (
    <Card mode="outlined" style={styles.card}>
      <Card.Title
        title={item.name}
        subtitle={
          item.contactPerson
            ? `${item.contactPerson}${item.phone ? ` • ${item.phone}` : ''}`
            : item.phone || ''
        }
        right={(props) => (
          <View style={styles.row}>
            {!item.isActive && (
              <Chip compact style={styles.inactiveChip}>
                Неактивен
              </Chip>
            )}
            <IconButton
              {...props}
              icon="pencil"
              onPress={() => openDialog(item)}
            />
            {item.isActive && (
              <IconButton
                {...props}
                icon="archive"
                onPress={() => handleDelete(item)}
              />
            )}
          </View>
        )}
      />
      {(item.email || item.address || item.notes) && (
        <Card.Content>
          {item.email && <Text variant="bodySmall">{item.email}</Text>}
          {item.address && (
            <Text variant="bodySmall">{item.address}</Text>
          )}
          {item.notes && (
            <Text variant="bodySmall" style={styles.notes}>
              {item.notes}
            </Text>
          )}
        </Card.Content>
      )}
    </Card>
  );

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <Searchbar
        placeholder="Поиск"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="truck-outline" title="Нет поставщиков" />
        }
      />
      <FAB icon="plus" style={styles.fab} onPress={() => openDialog()} />

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
          <Dialog.Title>
            {editing ? 'Редактировать' : 'Новый поставщик'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Название"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Контактное лицо"
              value={form.contactPerson || ''}
              onChangeText={(v) => setForm({ ...form, contactPerson: v })}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Телефон"
              value={form.phone || ''}
              onChangeText={(v) => setForm({ ...form, phone: maskPhone(v) })}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Email"
              value={form.email || ''}
              onChangeText={(v) => setForm({ ...form, email: v })}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Адрес"
              value={form.address || ''}
              onChangeText={(v) => setForm({ ...form, address: v })}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Примечание"
              value={form.notes || ''}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
              numberOfLines={2}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onPress={handleSave}
              loading={saving}
              disabled={!form.name.trim() || saving}
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
  search: { margin: 12 },
  list: { paddingHorizontal: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inactiveChip: { marginRight: 4 },
  notes: { marginTop: 4, fontStyle: 'italic', opacity: 0.8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  input: { marginBottom: 10 },
});
