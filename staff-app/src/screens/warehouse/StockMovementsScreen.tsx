import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Card,
  Chip,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  StockMovement,
  StockMovementType,
  getStockMovements,
} from '../../api/stock';

const TYPE_LABEL: Record<StockMovementType, string> = {
  receipt: 'Приход',
  issue: 'Расход',
  sale: 'Продажа',
  transfer_out: 'Перемещение →',
  transfer_in: 'Перемещение ←',
  return_customer: 'Возврат',
  return_supplier: 'Возврат пост.',
  adjustment: 'Корректировка',
  stocktake: 'Инвент.',
  rental_out: 'В прокат',
  rental_in: 'Из проката',
  writeoff: 'Списание',
};

const POSITIVE_TYPES = new Set<StockMovementType>([
  'receipt',
  'transfer_in',
  'return_customer',
  'rental_in',
]);
const NEGATIVE_TYPES = new Set<StockMovementType>([
  'issue',
  'sale',
  'transfer_out',
  'return_supplier',
  'writeoff',
  'rental_out',
]);

type Filter = 'all' | 'in' | 'out';

export default function StockMovementsScreen() {
  const theme = useTheme();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStockMovements({ limit: 200 });
      setMovements(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus so movements are fresh after a receive / sale / transfer
  // performed on another screen.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = movements.filter((m) => {
    if (filter === 'in' && !POSITIVE_TYPES.has(m.type)) return false;
    if (filter === 'out' && !NEGATIVE_TYPES.has(m.type)) return false;
    const q = search.trim().toLowerCase();
    if (q && !m.itemName.toLowerCase().includes(q)) return false;
    return true;
  });

  const renderItem = ({ item }: { item: StockMovement }) => {
    const sign =
      POSITIVE_TYPES.has(item.type) ? '+' : NEGATIVE_TYPES.has(item.type) ? '−' : '';
    const color =
      POSITIVE_TYPES.has(item.type)
        ? theme.colors.primary
        : NEGATIVE_TYPES.has(item.type)
          ? theme.colors.error
          : theme.colors.tertiary;

    return (
      <Card style={styles.card} mode="outlined">
        <Card.Title
          title={item.itemName}
          subtitle={`${TYPE_LABEL[item.type]} • #${item.movementNumber}`}
          right={() => (
            <View style={styles.right}>
              <Text variant="titleMedium" style={{ color, fontWeight: '600' }}>
                {sign}
                {item.quantity}
              </Text>
              <Text variant="labelSmall">
                остаток {item.balanceAfter}
              </Text>
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.metaRow}>
            <Chip compact>{item.source}</Chip>
            {item.counterparty && <Chip compact>{item.counterparty}</Chip>}
            {item.referenceType && (
              <Chip compact icon="link">
                {item.referenceType}
              </Chip>
            )}
          </View>
          {item.notes && (
            <Text variant="bodySmall" style={styles.notes}>
              {item.notes}
            </Text>
          )}
          <Text variant="labelSmall" style={styles.meta}>
            {new Date(item.createdAt).toLocaleString('ru-RU')}
          </Text>
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
          onValueChange={(v) => setFilter(v as Filter)}
          buttons={[
            { value: 'all', label: 'Все' },
            { value: 'in', label: 'Приход' },
            { value: 'out', label: 'Расход' },
          ]}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="clipboard-text" title="Журнал пуст" />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, gap: 8 },
  search: { backgroundColor: 'transparent' },
  list: { padding: 12 },
  card: { marginBottom: 12 },
  right: { alignItems: 'flex-end', paddingRight: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  notes: { marginTop: 6, fontStyle: 'italic' },
  meta: { marginTop: 6, opacity: 0.6 },
});
