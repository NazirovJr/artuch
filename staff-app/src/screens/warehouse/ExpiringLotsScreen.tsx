import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Card,
  Chip,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { StockLot, getExpiringLots } from '../../api/lots';

const WINDOWS: { value: number; label: string }[] = [
  { value: 7, label: '7 дн' },
  { value: 14, label: '14 дн' },
  { value: 30, label: '30 дн' },
  { value: 90, label: '90 дн' },
];

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function ExpiringLotsScreen() {
  const theme = useTheme();
  const [lots, setLots] = useState<StockLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [includeExpired, setIncludeExpired] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getExpiringLots(days, includeExpired);
      setLots(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [days, includeExpired]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: StockLot }) => {
    const left = daysLeft(item.expiresAt);
    const expired = left != null && left < 0;
    const urgent = left != null && left >= 0 && left <= 3;
    const color = expired
      ? theme.colors.error
      : urgent
        ? theme.colors.tertiary
        : theme.colors.onSurface;

    return (
      <Card mode="outlined" style={styles.card}>
        <Card.Title
          title={item.itemName}
          subtitle={
            item.lotCode
              ? `Партия ${item.lotCode}`
              : `получено ${new Date(item.receivedAt).toLocaleDateString('ru-RU')}`
          }
          right={() => (
            <View style={styles.right}>
              <Text style={{ color, fontWeight: '600' }}>
                {expired
                  ? `просрочено ${Math.abs(left!)} дн`
                  : `${left} дн`}
              </Text>
              <Text variant="labelSmall">
                {item.remainingQuantity} шт
              </Text>
            </View>
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <Chip
              compact
              icon={expired ? 'alert-octagon' : urgent ? 'alert' : 'calendar'}
              style={{ backgroundColor: color + '22' }}
              textStyle={{ color }}
            >
              {item.expiresAt
                ? new Date(item.expiresAt).toLocaleDateString('ru-RU')
                : '—'}
            </Chip>
            {item.supplierName && (
              <Chip compact icon="truck">
                {item.supplierName}
              </Chip>
            )}
            {item.unitCost && (
              <Chip compact>
                {(Number(item.unitCost) * Number(item.remainingQuantity)).toFixed(
                  2,
                )}
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>
          Партии с истекающим сроком
        </Text>
        <SegmentedButtons
          value={String(days)}
          onValueChange={(v) => setDays(Number(v))}
          buttons={WINDOWS.map((w) => ({
            value: String(w.value),
            label: w.label,
          }))}
        />
        <SegmentedButtons
          value={includeExpired ? 'with' : 'without'}
          onValueChange={(v) => setIncludeExpired(v === 'with')}
          buttons={[
            { value: 'with', label: 'Включая просроч.' },
            { value: 'without', label: 'Только не просроч.' },
          ]}
          style={styles.toggle}
        />
      </View>
      <FlatList
        data={lots}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="check-circle-outline"
            title="Нет партий с истекающим сроком"
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, gap: 10 },
  title: { fontWeight: '600' },
  toggle: {},
  list: { padding: 12 },
  card: { marginBottom: 12 },
  right: { alignItems: 'flex-end', paddingRight: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
