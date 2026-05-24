import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Banner,
  Button,
  Chip,
  Divider,
  IconButton,
  Searchbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import ScreenContainer from '../../components/ui/ScreenContainer';
import EmptyState from '../../components/ui/EmptyState';
import { getInventoryItems, updateInventoryItem, InventoryItem } from '../../api/inventory';
import { getWarehouseItems, WarehouseItem } from '../../api/warehouse-items';
import { useToast } from '../../components/ui/Toast';

export default function InventoryItemsScreen() {
  const theme = useTheme();
  const toast = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Picker modal state
  const [pickingFor, setPickingFor] = useState<InventoryItem | null>(null);
  const [pickSearch, setPickSearch] = useState('');
  const [bannerVisible, setBannerVisible] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [inv, wh] = await Promise.all([
        getInventoryItems(),
        getWarehouseItems(),
      ]);
      setItems(inv);
      setWarehouseItems(wh);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [items, search]);

  const whById = useMemo(
    () => new Map(warehouseItems.map((w) => [w.id, w])),
    [warehouseItems],
  );

  const filteredWh = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    if (!q) return warehouseItems;
    return warehouseItems.filter(
      (w) => w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q),
    );
  }, [warehouseItems, pickSearch]);

  const handleLink = async (invItem: InventoryItem, whItem: WarehouseItem | null) => {
    setSaving(true);
    try {
      const updated = await updateInventoryItem(invItem.id, {
        warehouseItemId: whItem?.id ?? undefined,
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.show(
        whItem ? `Привязан к «${whItem.name}»` : 'Привязка снята',
        'success',
      );
      setPickingFor(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const linkedCount = useMemo(
    () => items.filter((i) => i.warehouseItemId).length,
    [items],
  );

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const linked = item.warehouseItemId ? whById.get(item.warehouseItemId) : undefined;
    return (
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <Text variant="titleSmall" numberOfLines={1}>{item.name}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {item.category} · {item.unit} · остаток: {item.stock}
            </Text>
            {linked ? (
              <View style={styles.linkRow}>
                <Chip
                  compact
                  icon="warehouse"
                  mode="flat"
                  style={{ backgroundColor: theme.colors.secondaryContainer, marginTop: 4 }}
                  textStyle={{ fontSize: 11 }}
                  onClose={() =>
                    Alert.alert(
                      'Снять привязку',
                      `Снять привязку «${item.name}» от «${linked.name}»?`,
                      [
                        { text: 'Отмена', style: 'cancel' },
                        { text: 'Снять', style: 'destructive', onPress: () => handleLink(item, null) },
                      ],
                    )
                  }
                >
                  {linked.name} ({linked.unit})
                </Chip>
              </View>
            ) : (
              <Button
                mode="text"
                compact
                icon="link-plus"
                style={{ alignSelf: 'flex-start', marginTop: 2, marginLeft: -8 }}
                onPress={() => { setPickingFor(item); setPickSearch(''); }}
              >
                Привязать к складу
              </Button>
            )}
          </View>
          {linked && (
            <IconButton
              icon="pencil-outline"
              size={18}
              iconColor={theme.colors.primary}
              onPress={() => { setPickingFor(item); setPickSearch(''); }}
            />
          )}
        </View>
      </Surface>
    );
  };

  return (
    <ScreenContainer>
      <Banner
        visible={bannerVisible}
        actions={[{ label: 'Понятно', onPress: () => setBannerVisible(false) }]}
        icon="information-outline"
      >
        Свяжите каждую POS-позицию с товаром на складе.
        Тогда бармен сможет «получать» товар со склада — и сток обоих мест будет синхронизирован.
      </Banner>

      <Searchbar
        placeholder="Поиск POS-позиций…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {!loading && items.length > 0 && (
        <Text variant="bodySmall" style={styles.counter}>
          Привязано: {linkedCount} / {items.length}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="cube-outline" title="Нет позиций" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Warehouse item picker modal */}
      <Modal
        visible={!!pickingFor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickingFor(null)}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" numberOfLines={1}>
                Привязать к складу
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.6 }} numberOfLines={1}>
                POS-позиция: {pickingFor?.name} ({pickingFor?.unit})
              </Text>
            </View>
            <IconButton icon="close" onPress={() => setPickingFor(null)} />
          </View>
          <Text variant="bodySmall" style={styles.modalHint}>
            Выберите складской товар, который соответствует этой POS-позиции.
            При пополнении бара сток склада уменьшится, сток кассы увеличится.
          </Text>
          <Searchbar
            placeholder="Найти склад…"
            value={pickSearch}
            onChangeText={setPickSearch}
            style={styles.pickSearch}
          />
          <FlatList
            data={filteredWh}
            keyExtractor={(w) => w.id}
            ItemSeparatorComponent={() => <Divider />}
            renderItem={({ item: w }) => {
              const isSelected = pickingFor?.warehouseItemId === w.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.pickRow,
                    isSelected && { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                  onPress={() => pickingFor && handleLink(pickingFor, w)}
                  disabled={saving}
                >
                  <View>
                    <Text variant="bodyMedium">{w.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {w.category} · {w.unit} · {w.quantity} в наличии
                    </Text>
                  </View>
                  {isSelected && (
                    <IconButton icon="check" size={18} iconColor={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyPick}>Нет товаров на складе</Text>
            }
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: { margin: 12 },
  counter: { marginHorizontal: 16, marginBottom: 4, opacity: 0.55 },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  card: { borderRadius: 10, padding: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap' },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHint: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    opacity: 0.6,
    lineHeight: 18,
  },
  pickSearch: { margin: 12 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyPick: { textAlign: 'center', marginTop: 32, opacity: 0.5 },
});
