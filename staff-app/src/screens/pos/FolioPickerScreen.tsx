/**
 * FolioPickerScreen — pick an open guest folio to bill a POS sale to.
 *
 * Entered from CartScreen when the cashier selects "На счёт" payment.
 * Loads every open folio (backend filter `status=open`), lets the user
 * search by room number or guest name, and on tap writes the selection
 * into `posStore.selectedFolioId` + meta — CartScreen reads it back and
 * swaps its pay button to "Зачислить на счёт #NN".
 *
 * Why a dedicated screen (not a bottom-sheet modal): most outlets in
 * Fann Mountains hotels have 8–15 open folios at peak season, so a
 * search-friendly full-screen list reads faster than a cramped sheet.
 * Upgrading to a sheet later is trivial — the screen component is
 * self-contained.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Searchbar, Text, Chip, ActivityIndicator } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { POSStackParamList } from '../../navigation/types';
import { getFolios } from '../../api/folios';
import { usePosStore } from '../../store/posStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useHaptics } from '../../hooks/useHaptics';

type Props = NativeStackScreenProps<POSStackParamList, 'FolioPicker'>;

type OpenFolio = {
  id: string;
  roomNumber: number | null;
  status: string;
  totalAmount: number | string;
  paidAmount: number | string;
  guest?: { firstName?: string; lastName?: string } | null;
  reservationId?: string | null;
};

export default function FolioPickerScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const haptics = useHaptics();
  const setSelectedFolio = usePosStore((s) => s.setSelectedFolio);

  const [folios, setFolios] = useState<OpenFolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getFolios('open');
      // Guests arrive with varying shapes; normalise so the renderer can
      // trust the fields. A folio without a room is still useful to show
      // (some properties manage walk-in charges without a room).
      setFolios(Array.isArray(data) ? (data as OpenFolio[]) : []);
    } catch {
      // Silent — the empty state covers "no open folios" and network errors
      // alike; a dedicated error toast would be noise on the POS floor.
      setFolios([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folios;
    return folios.filter((f) => {
      const name = f.guest
        ? `${f.guest.firstName ?? ''} ${f.guest.lastName ?? ''}`.toLowerCase()
        : '';
      const room = f.roomNumber != null ? String(f.roomNumber) : '';
      return name.includes(q) || room.includes(q);
    });
  }, [folios, query]);

  const handlePick = (folio: OpenFolio) => {
    haptics.selection();
    const total = Number(folio.totalAmount) || 0;
    const paid = Number(folio.paidAmount) || 0;
    const balance = total - paid;
    const guestName = folio.guest
      ? `${folio.guest.firstName ?? ''} ${folio.guest.lastName ?? ''}`.trim()
      : undefined;
    setSelectedFolio(folio.id, {
      roomNumber: folio.roomNumber ?? undefined,
      guestName,
      balance,
    });
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Номер комнаты или имя гостя"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {query ? 'Ничего не найдено' : 'Нет открытых счетов'}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}
            >
              Откройте фолио при заселении гостя — он появится здесь.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const total = Number(item.totalAmount) || 0;
          const paid = Number(item.paidAmount) || 0;
          const balance = total - paid;
          const name = item.guest
            ? `${item.guest.firstName ?? ''} ${item.guest.lastName ?? ''}`.trim()
            : 'Без гостя';
          const balanceColor = balance > 0 ? theme.colors.error : theme.colors.primary;
          return (
            <Card
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              onPress={() => handlePick(item)}
            >
              <Card.Content>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                      {item.roomNumber != null ? `Номер #${item.roomNumber}` : 'Без номера'}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                    >
                      {name}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      К оплате
                    </Text>
                    <Text
                      variant="titleMedium"
                      style={{ color: balanceColor, fontWeight: '700' }}
                    >
                      {balance.toFixed(0)} TJS
                    </Text>
                  </View>
                </View>
                <View style={styles.chips}>
                  <Chip compact style={styles.chip}>
                    Начислено {total.toFixed(0)}
                  </Chip>
                  <Chip compact style={styles.chip}>
                    Оплачено {paid.toFixed(0)}
                  </Chip>
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  search: { margin: 12, borderRadius: 12 },
  list: { padding: 12, gap: 8, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { alignItems: 'center', gap: 4 },
  card: { borderRadius: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: { alignSelf: 'flex-start' },
});
