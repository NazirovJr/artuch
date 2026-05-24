import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Searchbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import ScreenContainer from '../../components/ui/ScreenContainer';
import EmptyState from '../../components/ui/EmptyState';
import { getInventoryItems, receiveFromWarehouse } from '../../api/inventory';
import type { InventoryItem } from '../../api/inventory';
import { getWarehouseItems } from '../../api/warehouse-items';
import type { WarehouseItem } from '../../api/warehouse-items';
import { getOutlets } from '../../api/outlets';
import type { Outlet } from '../../api/outlets';
import { useToast } from '../../components/ui/Toast';

/**
 * Bartender "receive from warehouse" screen.
 *
 * Flow:
 *  1. Find the bar outlet (type='bar') and its linked warehouseId.
 *  2. Load all warehouse items from that warehouse.
 *  3. For each warehouse item, find the matching POS InventoryItem
 *     (InventoryItem.warehouseItemId === warehouseItem.id).
 *  4. Only items with a linked POS position can be received
 *     (need the inventory item ID to increment bar stock).
 *
 * Configuration:
 *  - Link outlet → warehouse:  Admin → Точки продаж → edit "Бар" → выбрать склад
 *  - Link warehouse item → POS: Admin → POS → Склад
 */
export default function BarReceiveScreen() {
  const theme = useTheme();
  const toast = useToast();

  const [barOutlet, setBarOutlet] = useState<Outlet | null>(null);
  const [whItems, setWhItems] = useState<WarehouseItem[]>([]);
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receive modal state
  const [receiving, setReceiving] = useState<WarehouseItem | null>(null);
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [outlets, wh, inv] = await Promise.all([
        getOutlets(),
        getWarehouseItems(),
        getInventoryItems(),
      ]);

      const bar = outlets.find((o) => o.type === 'bar') ?? null;
      setBarOutlet(bar);

      // Only items from the bar's linked warehouse
      const barWh = bar?.warehouseId
        ? wh.filter((w) => w.warehouseId === bar.warehouseId)
        : [];
      setWhItems(barWh);
      setInvItems(inv);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Map warehouse item ID → linked POS inventory item.
   * Only items that have warehouseItemId set will appear as receivable.
   */
  const invByWhItemId = useMemo(
    () => new Map(invItems.filter((i) => i.warehouseItemId).map((i) => [i.warehouseItemId!, i])),
    [invItems],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return whItems;
    return whItems.filter((w) => w.name.toLowerCase().includes(q));
  }, [whItems, search]);

  const handleReceive = async () => {
    if (!receiving) return;
    const invItem = invByWhItemId.get(receiving.id);
    if (!invItem) return;

    const n = parseFloat(qty);
    if (!n || n <= 0) {
      toast.show('Введите количество', 'error');
      return;
    }
    if (n > Number(receiving.quantity)) {
      toast.show(`На складе только ${receiving.quantity} ${receiving.unit}`, 'error');
      return;
    }
    setSaving(true);
    try {
      await receiveFromWarehouse(invItem.id, n);
      toast.show(`Получено ${n} ${receiving.unit}`, 'success');
      setReceiving(null);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось получить товар');
    } finally {
      setSaving(false);
    }
  };

  // ── Empty states ─────────────────────────────────────────────────

  if (!loading && !barOutlet?.warehouseId) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="warehouse"
          title="Склад не привязан к бару"
          subtitle="Администратор → Точки продаж → редактировать «Бар» → выбрать склад"
        />
      </ScreenContainer>
    );
  }

  // ── Render item ──────────────────────────────────────────────────

  const renderItem = ({ item: w }: { item: WarehouseItem }) => {
    const invItem = invByWhItemId.get(w.id);
    const canReceive = !!invItem;
    const outOfStock = Number(w.quantity) <= 0;

    return (
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface, opacity: canReceive ? 1 : 0.55 }]}
        elevation={1}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall">{w.name}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              На складе: {w.quantity} {w.unit}
              {invItem ? ` · В баре: ${invItem.stock} ${invItem.unit}` : ''}
            </Text>
            {!canReceive && (
              <Chip
                compact
                icon="alert-outline"
                style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: theme.colors.errorContainer }}
                textStyle={{ fontSize: 10 }}
              >
                Нет POS-позиции — Admin → POS → Склад
              </Chip>
            )}
          </View>
          <Button
            mode="contained-tonal"
            compact
            disabled={!canReceive || outOfStock}
            onPress={() => { setReceiving(w); setQty(''); }}
          >
            {outOfStock ? 'Нет на складе' : 'Получить'}
          </Button>
        </View>
      </Surface>
    );
  };

  // ── Main render ──────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <Searchbar
        placeholder="Поиск товаров…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="package-variant-closed"
          title="Нет товаров в складе"
          subtitle="Добавьте позиции в склад, привязанный к бару"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(w) => w.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Receive quantity modal */}
      <Modal
        visible={!!receiving}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiving(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={styles.modalTitle}>
              Получить «{receiving?.name}»
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
              На складе: {receiving?.quantity ?? '—'} {receiving?.unit}
            </Text>
            <TextInput
              mode="outlined"
              label={`Количество (${receiving?.unit})`}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Button onPress={() => setReceiving(null)} disabled={saving}>Отмена</Button>
              <Button mode="contained" onPress={handleReceive} loading={saving} disabled={saving}>
                Получить
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: { margin: 12 },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  card: { borderRadius: 10, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modal: { borderRadius: 16, padding: 20 },
  modalTitle: { marginBottom: 4, fontWeight: 'bold' },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
});
