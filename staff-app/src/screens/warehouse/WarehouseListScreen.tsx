import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Text, Card, FAB, Chip, IconButton, Portal, Dialog, TextInput, Button, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, Warehouse, CreateWarehouseData } from '../../api/warehouses';
import { getLowStockAlerts } from '../../api/alerts';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useToast } from '../../components/ui/Toast';
import OutboxBadge from '../../components/OutboxBadge';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'WarehouseList'>;

const WAREHOUSE_TYPES = [
  { value: 'products', label: 'Продукты' },
  { value: 'beverages', label: 'Напитки' },
  { value: 'equipment', label: 'Снаряжение' },
  { value: 'rental', label: 'Прокат' },
  { value: 'general', label: 'Общий' },
];

function getTypeLabel(type: string): string {
  return WAREHOUSE_TYPES.find((t) => t.value === type)?.label || type;
}

export default function WarehouseListScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('general');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try {
      setLoading(true);
      const [data, alerts] = await Promise.all([
        getWarehouses(),
        getLowStockAlerts().catch(() => []),
      ]);
      setWarehouses(data);
      setOpenAlertCount(alerts.length);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить склады');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
    const unsub = navigation.addListener('focus', loadWarehouses);
    return unsub;
  }, [loadWarehouses, navigation]);

  const openCreateDialog = () => {
    setEditingWarehouse(null);
    setFormName('');
    setFormType('general');
    setFormDescription('');
    setDialogVisible(true);
  };

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setFormName(warehouse.name);
    setFormType(warehouse.type);
    setFormDescription(warehouse.description || '');
    setDialogVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, {
          name: formName.trim(),
          type: formType,
          description: formDescription.trim() || undefined,
        });
      } else {
        const data: CreateWarehouseData = {
          name: formName.trim(),
          type: formType,
          description: formDescription.trim() || undefined,
        };
        await createWarehouse(data);
      }
      setDialogVisible(false);
      await loadWarehouses();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (warehouse: Warehouse) => {
    Alert.alert(
      'Удалить склад?',
      `"${warehouse.name}" будет деактивирован.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWarehouse(warehouse.id);
              await loadWarehouses();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось удалить');
            }
          },
        },
      ],
    );
  };

  const renderWarehouse = ({ item }: { item: Warehouse }) => (
    <Card
      style={styles.card}
      mode="outlined"
      onPress={() =>
        navigation.navigate('WarehouseDetail', { warehouseId: item.id })
      }
    >
      <Card.Title
        title={item.name}
        subtitle={item.description || getTypeLabel(item.type)}
        right={(props) => (
          <View style={styles.cardActions}>
            <IconButton {...props} icon="pencil" onPress={() => openEditDialog(item)} />
            <IconButton {...props} icon="delete" onPress={() => handleDelete(item)} />
          </View>
        )}
      />
      <Card.Content>
        <View style={styles.chipRow}>
          <Chip style={styles.chip} compact>{getTypeLabel(item.type)}</Chip>
          {item.isActive && <Chip style={styles.chip} compact icon="check">Активен</Chip>}
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.titleRow}>
        <Text variant="headlineSmall" style={styles.title}>Склады</Text>
        <OutboxBadge />
      </View>
      <View style={styles.shortcuts}>
        <Button
          mode="outlined"
          icon="alert"
          compact
          onPress={() => navigation.navigate('LowStockAlerts')}
        >
          {openAlertCount > 0 ? `Алерты (${openAlertCount})` : 'Алерты'}
        </Button>
        <Button
          mode="outlined"
          icon="swap-horizontal"
          compact
          onPress={() => navigation.navigate('TransferList')}
        >
          Перемещения
        </Button>
        <Button
          mode="outlined"
          icon="clipboard-list"
          compact
          onPress={() => navigation.navigate('StocktakeList', {})}
        >
          Инвент.
        </Button>
        <Button
          mode="outlined"
          icon="clipboard-text"
          compact
          onPress={() => navigation.navigate('StockMovements')}
        >
          Журнал
        </Button>
        <Button
          mode="outlined"
          icon="calendar-clock"
          compact
          onPress={() => navigation.navigate('ExpiringLots')}
        >
          Просрочка
        </Button>
        <Button
          mode="outlined"
          icon="chart-line"
          compact
          onPress={() => navigation.navigate('StockReports')}
        >
          Отчёты
        </Button>
        <Button
          mode="outlined"
          icon="truck-outline"
          compact
          onPress={() => navigation.navigate('Suppliers')}
        >
          Поставщики
        </Button>
      </View>
      <FlatList
        data={warehouses}
        keyExtractor={(item) => item.id}
        renderItem={renderWarehouse}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="warehouse" title="Нет складов" actionLabel="Создать склад" />
        }
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreateDialog} />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>
            {editingWarehouse ? 'Редактировать склад' : 'Новый склад'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Название"
              value={formName}
              onChangeText={setFormName}
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Описание"
              value={formDescription}
              onChangeText={setFormDescription}
              style={styles.input}
              mode="outlined"
              multiline
            />
            <Text variant="labelMedium" style={styles.typeLabel}>Тип</Text>
            <View style={styles.typeRow}>
              {WAREHOUSE_TYPES.map((t) => (
                <Chip
                  key={t.value}
                  selected={formType === t.value}
                  onPress={() => setFormType(t.value)}
                  showSelectedCheck={false}
                  style={styles.typeChip}
                >
                  {t.label}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontWeight: 'bold' },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12 },
  cardActions: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { alignSelf: 'flex-start' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  input: { marginBottom: 12 },
  typeLabel: { marginBottom: 8 },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  typeChip: {},
});
