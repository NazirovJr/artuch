import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FAB,
  Portal,
  Dialog,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  Stocktake,
  StocktakeStatus,
  createStocktake,
  getStocktakes,
} from '../../api/stocktakes';
import { Warehouse, getWarehouses } from '../../api/warehouses';
import { useAuthStore } from '../../store/authStore';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'StocktakeList'>;

const STATUS_LABEL: Record<StocktakeStatus, string> = {
  in_progress: 'В работе',
  awaiting_approval: 'На утверждение',
  approved: 'Утверждено',
  cancelled: 'Отменено',
};

const STATUS_COLOR: Record<StocktakeStatus, 'primary' | 'tertiary' | 'outline' | 'error'> = {
  in_progress: 'primary',
  awaiting_approval: 'tertiary',
  approved: 'outline',
  cancelled: 'error',
};

type Tab = 'open' | 'all';

export default function StocktakeListScreen({ route, navigation }: Props) {
  const presetWarehouseId = route.params?.warehouseId;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('open');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formWarehouseId, setFormWarehouseId] = useState<string | undefined>(
    presetWarehouseId,
  );
  const [formCategory, setFormCategory] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [w, all] = await Promise.all([getWarehouses(), getStocktakes(presetWarehouseId)]);
      setWarehouses(w.filter((x) => x.isActive));
      const filtered =
        tab === 'open'
          ? all.filter(
              (s) =>
                s.status === 'in_progress' || s.status === 'awaiting_approval',
            )
          : all;
      setStocktakes(filtered);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить инвентаризации');
    } finally {
      setLoading(false);
    }
  }, [tab, presetWarehouseId]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const handleCreate = async () => {
    if (!formWarehouseId || !user) return;
    setCreating(true);
    try {
      const created = await createStocktake({
        warehouseId: formWarehouseId,
        countedBy: user.id,
        category: formCategory.trim() || undefined,
        kind: formCategory.trim() ? 'cycle' : 'full',
      });
      setDialogOpen(false);
      setFormCategory('');
      navigation.navigate('StocktakeDetail', { stocktakeId: created.id });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать');
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({ item }: { item: Stocktake }) => (
    <Card
      style={styles.card}
      mode="outlined"
      onPress={() =>
        navigation.navigate('StocktakeDetail', { stocktakeId: item.id })
      }
    >
      <Card.Title
        title={item.warehouse?.name ?? 'Склад'}
        subtitle={
          item.kind === 'cycle' && item.category
            ? `Категория: ${item.category}`
            : 'Полная инвентаризация'
        }
        right={() => (
          <Chip
            compact
            style={[
              styles.statusChip,
              {
                backgroundColor:
                  theme.colors[STATUS_COLOR[item.status]] + '22',
              },
            ]}
            textStyle={{ color: theme.colors[STATUS_COLOR[item.status]] }}
          >
            {STATUS_LABEL[item.status]}
          </Chip>
        )}
      />
      <Card.Content>
        <Text variant="labelSmall" style={styles.meta}>
          Начато {new Date(item.createdAt).toLocaleString('ru-RU')}
        </Text>
        {item.notes && (
          <Text variant="bodySmall" style={styles.notes}>
            {item.notes}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'open', label: 'Активные' },
            { value: 'all', label: 'Все' },
          ]}
        />
      </View>
      <FlatList
        data={stocktakes}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="clipboard-list" title="Нет инвентаризаций" />
        }
      />
      <FAB
        icon="plus"
        label="Начать"
        style={styles.fab}
        onPress={() => {
          setFormWarehouseId(presetWarehouseId);
          setDialogOpen(true);
        }}
      />

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
          <Dialog.Title>Новая инвентаризация</Dialog.Title>
          <Dialog.Content>
            <Text variant="labelMedium" style={styles.label}>Склад</Text>
            <View style={styles.chipRow}>
              {warehouses.map((w) => (
                <Button
                  key={w.id}
                  compact
                  mode={formWarehouseId === w.id ? 'contained' : 'outlined'}
                  onPress={() => setFormWarehouseId(w.id)}
                  style={styles.chipBtn}
                >
                  {w.name}
                </Button>
              ))}
            </View>
            <TextInput
              mode="outlined"
              label="Категория (для cycle count, опционально)"
              value={formCategory}
              onChangeText={setFormCategory}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onPress={handleCreate}
              loading={creating}
              disabled={!formWarehouseId || creating}
            >
              Начать
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12 },
  list: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  statusChip: { marginRight: 8 },
  meta: { opacity: 0.6 },
  notes: { marginTop: 4, fontStyle: 'italic' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  label: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chipBtn: { marginRight: 4, marginBottom: 4 },
  input: { marginTop: 8 },
});
