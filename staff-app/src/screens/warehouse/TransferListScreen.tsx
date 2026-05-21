import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FAB,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  StockTransfer,
  TransferStatus,
  getTransfers,
} from '../../api/transfers';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'TransferList'>;

const STATUS_LABEL: Record<TransferStatus, string> = {
  in_transit: 'В пути',
  received: 'Получено',
  cancelled: 'Отменено',
};

export default function TransferListScreen({ navigation }: Props) {
  const theme = useTheme();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TransferStatus>('in_transit');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTransfers(tab);
      setTransfers(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить перемещения');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const renderItem = ({ item }: { item: StockTransfer }) => {
    const variance =
      item.receivedQuantity != null && item.receivedQuantity < item.quantity
        ? item.quantity - item.receivedQuantity
        : 0;
    return (
      <Card
        style={styles.card}
        mode="outlined"
        onPress={() =>
          item.status === 'in_transit' &&
          navigation.navigate('ReceiveTransfer', { transferId: item.id })
        }
      >
        <Card.Title
          title={item.sourceItem?.name ?? '—'}
          subtitle={`${item.sourceWarehouse?.name ?? '?'} → ${
            item.targetWarehouse?.name ?? '?'
          }`}
          right={() => (
            <Chip
              compact
              icon={
                item.status === 'received'
                  ? 'check'
                  : item.status === 'cancelled'
                    ? 'close'
                    : 'truck-fast'
              }
              style={styles.statusChip}
            >
              {STATUS_LABEL[item.status]}
            </Chip>
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <Text>
              {item.quantity} {item.sourceItem?.unit ?? ''}
              {item.receivedQuantity != null &&
                item.receivedQuantity !== item.quantity &&
                ` → принято ${item.receivedQuantity}`}
            </Text>
            {variance > 0 && (
              <Chip
                compact
                icon="alert"
                style={{ backgroundColor: theme.colors.errorContainer }}
              >
                Недостача {variance}
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
        {item.status === 'in_transit' && (
          <Card.Actions>
            <Button
              onPress={() =>
                navigation.navigate('ReceiveTransfer', {
                  transferId: item.id,
                })
              }
            >
              Принять
            </Button>
          </Card.Actions>
        )}
      </Card>
    );
  };

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as TransferStatus)}
          buttons={[
            { value: 'in_transit', label: 'В пути' },
            { value: 'received', label: 'Получены' },
            { value: 'cancelled', label: 'Отменены' },
          ]}
        />
      </View>
      <FlatList
        data={transfers}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="truck" title="Нет перемещений" />
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('NewTransfer', {})}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12 },
  list: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusChip: { marginRight: 8 },
  notes: { marginTop: 4, fontStyle: 'italic' },
  meta: { marginTop: 8, opacity: 0.6 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
