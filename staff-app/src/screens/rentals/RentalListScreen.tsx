import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, Chip, FAB, useTheme } from 'react-native-paper';
import { useRentalStore } from '../../store/rentalStore';
import { getRentals } from '../../api/rentals';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WarehouseStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { useToast } from '../../components/ui/Toast';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'RentalList'>;

const STATUS_FILTERS = [
  { key: undefined, label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'overdue', label: 'Просрочены' },
  { key: 'returned', label: 'Возвращены' },
  { key: 'damaged', label: 'Повреждены' },
] as const;

export default function RentalListScreen({ navigation }: Props) {
  const { rentals, loading, setRentals, setLoading } = useRentalStore();
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const theme = useTheme();
  const toast = useToast();

  const fetchRentals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRentals(activeFilter);
      setRentals(data);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, setRentals, setLoading]);

  useEffect(() => {
    fetchRentals();
  }, [fetchRentals]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRentals();
    });
    return unsubscribe;
  }, [navigation, fetchRentals]);

  const isOverdue = (rental: any) =>
    rental.status === 'active' && new Date(rental.expectedReturn) < new Date();

  const getEffectiveStatus = (rental: any) => {
    if (isOverdue(rental)) return 'overdue';
    return rental.status;
  };

  const renderRental = ({ item }: { item: any }) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('RentalDetail', { rentalId: item.id })}
    >
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={styles.itemName}>
            {item.itemName}
          </Text>
          <StatusBadge status={getEffectiveStatus(item)} domain="rental" />
        </View>

        {item.guestId && (
          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Гость:</Text>
            <Text variant="bodyMedium">{item.guestId}</Text>
          </View>
        )}

        <View style={styles.cardRow}>
          <Text variant="bodyMedium" style={styles.label}>Кол-во:</Text>
          <Text variant="bodyMedium">{item.quantity}</Text>
        </View>

        <View style={styles.cardRow}>
          <Text variant="bodyMedium" style={styles.label}>Выдача:</Text>
          <Text variant="bodyMedium">
            {new Date(item.issuedAt).toLocaleDateString('ru-RU')}
          </Text>
        </View>

        <View style={styles.cardRow}>
          <Text variant="bodyMedium" style={styles.label}>Возврат до:</Text>
          <Text
            variant="bodyMedium"
            style={isOverdue(item) ? { color: '#EF4444', fontWeight: 'bold' } : undefined}
          >
            {new Date(item.expectedReturn).toLocaleDateString('ru-RU')}
          </Text>
        </View>

        <View style={styles.cardRow}>
          <Text variant="bodyMedium" style={styles.label}>Цена/день:</Text>
          <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
            {Number(item.pricePerDay).toFixed(2)} TJS
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <Chip
            key={filter.label}
            selected={activeFilter === filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={styles.filterChip}
            compact
          >
            {filter.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={rentals}
        keyExtractor={(item) => item.id}
        renderItem={renderRental}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRentals} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="bike" title="Нет арендов" />
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('NewRental')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: { marginBottom: 4 },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: { fontWeight: 'bold', flex: 1, marginRight: 8 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: { opacity: 0.6, marginRight: 4 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
  },
});
