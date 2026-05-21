import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FAB,
  IconButton,
  SegmentedButtons,
  Searchbar,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  WarehouseItem,
  getWarehouseItems,
} from '../../api/warehouse-items';
import { getWarehouseById, Warehouse } from '../../api/warehouses';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'WarehouseDetail'>;

type QuickFilter = 'all' | 'low' | 'out';

export default function WarehouseDetailScreen({ route, navigation }: Props) {
  const { warehouseId } = route.params;
  const theme = useTheme();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [w, all] = await Promise.all([
        getWarehouseById(warehouseId),
        getWarehouseItems(),
      ]);
      setWarehouse(w);
      setItems(all.filter((i) => i.warehouseId === warehouseId));
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить склад');
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  useEffect(() => {
    navigation.setOptions({ title: warehouse?.name ?? 'Склад' });
  }, [warehouse?.name, navigation]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      const ropEffective =
        Number(it.reorderPoint) > 0
          ? Number(it.reorderPoint)
          : Number(it.minQuantity);
      const qty = Number(it.quantity);
      if (filter === 'low' && !(qty <= ropEffective && qty > 0)) return false;
      if (filter === 'out' && qty > 0) return false;
      return true;
    });
  }, [items, search, filter]);

  const renderItem = ({ item }: { item: WarehouseItem }) => {
    const ropEffective =
      Number(item.reorderPoint) > 0
        ? Number(item.reorderPoint)
        : Number(item.minQuantity);
    const qty = Number(item.quantity);
    const status: 'ok' | 'low' | 'out' =
      qty <= 0 ? 'out' : qty <= ropEffective ? 'low' : 'ok';
    const statusColor =
      status === 'out'
        ? theme.colors.error
        : status === 'low'
          ? theme.colors.tertiary
          : theme.colors.primary;

    return (
      <Card style={styles.card} mode="outlined">
        <Card.Title
          title={item.name}
          subtitle={item.category}
          right={(props) => (
            <View style={styles.row}>
              <IconButton
                {...props}
                icon="arrow-down-bold-circle"
                iconColor={theme.colors.primary}
                onPress={() =>
                  navigation.navigate('ReceiveStock', {
                    warehouseId,
                    itemId: item.id,
                    mode: 'income',
                  })
                }
              />
              <IconButton
                {...props}
                icon="arrow-up-bold-circle"
                iconColor={theme.colors.error}
                onPress={() =>
                  navigation.navigate('ReceiveStock', {
                    warehouseId,
                    itemId: item.id,
                    mode: 'expense',
                  })
                }
              />
              <IconButton
                {...props}
                icon="ruler"
                onPress={() =>
                  navigation.navigate('UnitConversions', {
                    source: 'warehouse',
                    itemId: item.id,
                    itemName: item.name,
                  })
                }
              />
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.qtyRow}>
            <Text variant="headlineSmall" style={{ color: statusColor }}>
              {qty} {item.unit}
            </Text>
            <View style={styles.thresholds}>
              {Number(item.parLevel) > 0 && (
                <Text variant="labelSmall">PAR: {item.parLevel}</Text>
              )}
              <Text variant="labelSmall">ROP: {ropEffective}</Text>
              <Text variant="labelSmall">Цена: {item.price}</Text>
            </View>
          </View>
          {status !== 'ok' && (
            <Chip
              icon="alert"
              compact
              style={[styles.statusChip, { backgroundColor: statusColor + '22' }]}
              textStyle={{ color: statusColor }}
            >
              {status === 'out' ? 'Закончилось' : 'Низкий остаток'}
            </Chip>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={6} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <Searchbar
          placeholder="Поиск товара"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as QuickFilter)}
          buttons={[
            { value: 'all', label: `Все (${items.length})` },
            { value: 'low', label: 'Низкий' },
            { value: 'out', label: 'Закончилось' },
          ]}
          style={styles.segmented}
        />
        <View style={styles.actionRow}>
          <Button
            mode="outlined"
            icon="barcode-scan"
            onPress={() =>
              navigation.navigate('BarcodeLookup', {
                warehouseId,
                mode: 'income',
              })
            }
          >
            Сканировать
          </Button>
          <Button
            mode="outlined"
            icon="swap-horizontal"
            onPress={() =>
              navigation.navigate('NewTransfer', {
                sourceWarehouseId: warehouseId,
              })
            }
          >
            Перемещение
          </Button>
          <Button
            mode="outlined"
            icon="clipboard-list"
            onPress={() =>
              navigation.navigate('StocktakeList', { warehouseId })
            }
          >
            Инвентаризация
          </Button>
          <Button
            mode="outlined"
            icon="package-variant-plus"
            onPress={() =>
              navigation.navigate('NewWarehouseItem', { warehouseId })
            }
          >
            Новый товар
          </Button>
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="package-variant"
            title={
              search
                ? 'Ничего не найдено'
                : filter === 'all'
                  ? 'Склад пуст'
                  : 'По фильтру нет товаров'
            }
          />
        }
      />
      <FAB
        icon="plus"
        label="Приход"
        style={styles.fab}
        onPress={() =>
          navigation.navigate('ReceiveStock', { warehouseId, mode: 'income' })
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, gap: 10 },
  search: { backgroundColor: 'transparent' },
  segmented: {},
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  list: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row' },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  thresholds: { alignItems: 'flex-end', gap: 2 },
  statusChip: { alignSelf: 'flex-start', marginTop: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
