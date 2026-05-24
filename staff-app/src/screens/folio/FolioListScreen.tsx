import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, FAB, Chip, useTheme } from 'react-native-paper';
import { getFolios } from '../../api/folios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { semantic } from '../../theme/colors';

type Props = NativeStackScreenProps<RoomsStackParamList, 'FolioList'> & {
  /** Master-detail mode: tap calls this instead of navigating to FolioDetail. */
  onSelectFolio?: (folioId: string) => void;
  selectedFolioId?: string | null;
};

const FILTER_OPTIONS = [
  { key: undefined, label: 'Все' },
  { key: 'open', label: 'Открытые' },
  { key: 'closed', label: 'Закрытые' },
] as const;

export default function FolioListScreen({ navigation, onSelectFolio, selectedFolioId }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [folios, setFolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const openFolio = useCallback(
    (folioId: string) => {
      if (onSelectFolio) onSelectFolio(folioId);
      else navigation.navigate('FolioDetail', { folioId });
    },
    [onSelectFolio, navigation],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFolios(statusFilter);
      setFolios(data);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const renderFolio = ({ item }: { item: any }) => {
    const balance = Number(item.totalAmount || 0) - Number(item.paidAmount || 0);

    return (
      <Card
        style={[
          styles.card,
          selectedFolioId === item.id && {
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        onPress={() => openFolio(item.id)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.folioId}>
              #{item.id?.slice(0, 8)}
            </Text>
            <StatusBadge status={item.status} domain="folio" />
          </View>

          {item.roomNumber != null && (
            <View style={styles.cardRow}>
              <Text variant="bodyMedium" style={styles.label}>Номер:</Text>
              <Text variant="bodyMedium">#{item.roomNumber}</Text>
            </View>
          )}

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Начислено:</Text>
            <Text variant="bodyMedium">{Number(item.totalAmount || 0).toFixed(2)} TJS</Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Оплачено:</Text>
            <Text variant="bodyMedium">{Number(item.paidAmount || 0).toFixed(2)} TJS</Text>
          </View>

          <View style={styles.cardRow}>
            <Text variant="bodyMedium" style={styles.label}>Баланс:</Text>
            <Text
              variant="bodyMedium"
              style={{ color: balance > 0 ? semantic.error : semantic.success, fontWeight: 'bold' }}
            >
              {balance.toFixed(2)} TJS
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <Chip
            key={opt.label}
            selected={statusFilter === opt.key}
            onPress={() => setStatusFilter(opt.key as string | undefined)}
            style={styles.chip}
            mode="outlined"
          >
            {opt.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={folios}
        keyExtractor={(item) => item.id}
        renderItem={renderFolio}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="file-document-outline" title="Нет фолио" />
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('FolioCreate')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  chip: {},
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  folioId: { fontWeight: 'bold' },
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
