import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, Card, FAB, useTheme, ActivityIndicator, Chip, IconButton, Portal, Dialog, TextInput, Button, SegmentedButtons, RadioButton } from 'react-native-paper';
import { getOutlets, createOutlet, updateOutlet, deleteOutlet, Outlet, CreateOutletData } from '../../api/outlets';
import { getWarehouses, Warehouse } from '../../api/warehouses';

const OUTLET_TYPES = [
  { value: 'shop', label: 'Магазин' },
  { value: 'bar', label: 'Бар' },
  { value: 'restaurant', label: 'Ресторан' },
  { value: 'rental', label: 'Прокат' },
];

function getTypeLabel(type: string): string {
  return OUTLET_TYPES.find((t) => t.value === type)?.label || type;
}

export default function OutletManagementScreen() {
  const theme = useTheme();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('shop');
  const [formWarehouseId, setFormWarehouseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOutlets = useCallback(async () => {
    try {
      setLoading(true);
      const [data, wh] = await Promise.all([getOutlets(), getWarehouses()]);
      setOutlets(data);
      setWarehouses(wh);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить точки продаж');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  const openCreateDialog = () => {
    setEditingOutlet(null);
    setFormName('');
    setFormType('shop');
    setFormWarehouseId(null);
    setDialogVisible(true);
  };

  const openEditDialog = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormType(outlet.type);
    setFormWarehouseId(outlet.warehouseId ?? null);
    setDialogVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingOutlet) {
        await updateOutlet(editingOutlet.id, {
          name: formName.trim(),
          type: formType,
          warehouseId: formWarehouseId ?? undefined,
        });
      } else {
        const data: CreateOutletData = {
          name: formName.trim(),
          type: formType,
          warehouseId: formWarehouseId ?? undefined,
        };
        await createOutlet(data);
      }
      setDialogVisible(false);
      await loadOutlets();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (outlet: Outlet) => {
    Alert.alert(
      'Удалить точку продаж?',
      `"${outlet.name}" будет деактивирована.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOutlet(outlet.id);
              await loadOutlets();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось удалить');
            }
          },
        },
      ],
    );
  };

  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

  const renderOutlet = ({ item }: { item: Outlet }) => {
    const linkedWh = item.warehouseId ? warehouseById.get(item.warehouseId) : null;
    return (
      <Card style={styles.card} mode="outlined">
        <Card.Title
          title={item.name}
          subtitle={getTypeLabel(item.type)}
          right={(props) => (
            <View style={styles.cardActions}>
              <IconButton {...props} icon="pencil" onPress={() => openEditDialog(item)} />
              <IconButton {...props} icon="delete" onPress={() => handleDelete(item)} />
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.chipRow}>
            {linkedWh ? (
              <Chip icon="warehouse" style={styles.chip} compact>
                {linkedWh.name}
              </Chip>
            ) : (
              <Chip icon="warehouse" style={[styles.chip, { opacity: 0.45 }]} compact>
                Склад не привязан
              </Chip>
            )}
            {item.supportsFolio && <Chip style={styles.chip} compact>Фолио</Chip>}
            {item.supportsRental && <Chip style={styles.chip} compact>Прокат</Chip>}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={styles.title}>Точки продаж</Text>
      <FlatList
        data={outlets}
        keyExtractor={(item) => item.id}
        renderItem={renderOutlet}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Нет точек продаж</Text>
        }
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreateDialog} />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>
            {editingOutlet ? 'Редактировать' : 'Новая точка продаж'}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 460 }}>
            <ScrollView>
              <View style={styles.dialogContent}>
                <TextInput
                  label="Название"
                  value={formName}
                  onChangeText={setFormName}
                  style={styles.input}
                  mode="outlined"
                />
                <Text variant="labelMedium" style={styles.typeLabel}>Тип</Text>
                <SegmentedButtons
                  value={formType}
                  onValueChange={setFormType}
                  buttons={OUTLET_TYPES}
                  style={styles.segmented}
                />
                <Text variant="labelMedium" style={styles.typeLabel}>
                  Привязанный склад
                </Text>
                <Text variant="bodySmall" style={styles.warehouseHint}>
                  Сотрудники этой точки будут пополнять запасы именно с этого склада.
                </Text>
                <RadioButton.Group
                  value={formWarehouseId ?? ''}
                  onValueChange={(v) => setFormWarehouseId(v || null)}
                >
                  <RadioButton.Item
                    label="— Без склада"
                    value=""
                    style={styles.radioItem}
                  />
                  {warehouses.map((w) => (
                    <RadioButton.Item
                      key={w.id}
                      label={w.name}
                      value={w.id}
                      style={styles.radioItem}
                    />
                  ))}
                </RadioButton.Group>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Отмена</Button>
            <Button
              onPress={handleSave}
              loading={saving}
              disabled={!formName.trim() || saving}
            >
              Сохранить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontWeight: 'bold' },
  list: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12 },
  cardActions: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { alignSelf: 'flex-start' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  dialogContent: { paddingVertical: 8 },
  input: { marginBottom: 12 },
  typeLabel: { marginBottom: 8, marginTop: 4 },
  segmented: { marginBottom: 8 },
  warehouseHint: { opacity: 0.6, marginBottom: 8 },
  radioItem: { paddingVertical: 2 },
  emptyText: { textAlign: 'center', opacity: 0.6, marginTop: 32 },
});
