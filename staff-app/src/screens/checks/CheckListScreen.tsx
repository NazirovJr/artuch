import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  FAB,
  Chip,
  Portal,
  Dialog,
  TextInput,
  Button,
  useTheme,
} from 'react-native-paper';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getOpenChecks, openCheck, type TableCheck } from '../../api/checks';
import { semantic } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { useSocketEvent } from '../../socket/useSocketEvent';
import { useToast } from '../../components/ui/Toast';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'CheckList'>;

function readyCount(check: TableCheck): number {
  return (check.orders || [])
    .flatMap((o) => o.items || [])
    .filter((i) => i.status === 'ready').length;
}

export default function CheckListScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();
  const [checks, setChecks] = useState<TableCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [opening, setOpening] = useState(false);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      setChecks(await getOpenChecks());
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить столы', 'error');
    } finally {
      setLoading(false);
      setInitial(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchChecks);
    return unsub;
  }, [navigation, fetchChecks]);

  const onRealtime = useCallback(() => fetchChecks(), [fetchChecks]);
  useSocketEvent('check:opened', onRealtime);
  useSocketEvent('check:updated', onRealtime);
  useSocketEvent('check:closed', onRealtime);

  const handleOpenTable = useCallback(async () => {
    const table = tableNumber.trim().toUpperCase();
    if (!table) return;
    setOpening(true);
    try {
      const check = await openCheck({
        tableNumber: table,
        openedByName: user?.fullName,
      });
      setDialogOpen(false);
      setTableNumber('');
      navigation.navigate('CheckDetail', { checkId: check.id });
    } catch (e: any) {
      toast.show(e.message || 'Не удалось открыть стол', 'error');
    } finally {
      setOpening(false);
    }
  }, [tableNumber, user, navigation, toast]);

  const renderCheck = ({ item, index }: { item: TableCheck; index: number }) => {
    const ready = readyCount(item);
    const rounds = item.orders?.length || 0;
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
        <Card
          style={styles.card}
          onPress={() => navigation.navigate('CheckDetail', { checkId: item.id })}
        >
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge" style={styles.table}>
                Стол {item.tableNumber}
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {Number(item.total).toFixed(2)} TJS
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text variant="bodySmall" style={styles.meta}>
                Счёт #{item.checkNumber} · {rounds} {rounds === 1 ? 'заказ' : 'заказа'}
              </Text>
              {ready > 0 && (
                <Chip compact mode="flat" style={styles.readyChip} textStyle={styles.readyText}>
                  Готово к выдаче: {ready}
                </Chip>
              )}
            </View>
            {!!item.openedByName && (
              <Text variant="bodySmall" style={styles.meta}>
                Официант: {item.openedByName}
              </Text>
            )}
          </Card.Content>
        </Card>
      </Animated.View>
    );
  };

  if (initial && loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LoadingSkeleton count={5} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={checks}
        keyExtractor={(c) => c.id}
        renderItem={renderCheck}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchChecks} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="table-furniture"
              title="Нет открытых столов"
              subtitle="Откройте стол, чтобы принять заказ"
              actionLabel="Открыть стол"
              onAction={() => setDialogOpen(true)}
            />
          ) : null
        }
      />

      <FAB
        icon="plus"
        label="Открыть стол"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => setDialogOpen(true)}
      />

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
          <Dialog.Title>Открыть стол</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Номер стола"
              value={tableNumber}
              onChangeText={setTableNumber}
              autoCapitalize="characters"
              autoFocus
              maxLength={20}
              mode="outlined"
              onSubmitEditing={handleOpenTable}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              mode="contained"
              loading={opening}
              disabled={opening || !tableNumber.trim()}
              onPress={handleOpenTable}
            >
              Открыть
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  table: { fontWeight: 'bold' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: { opacity: 0.6 },
  readyChip: { backgroundColor: semantic.success },
  readyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  fab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 28 },
});
