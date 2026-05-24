import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, Alert } from 'react-native';
import {
  Badge,
  Button,
  Chip,
  Divider,
  IconButton,
  Modal,
  Portal,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ui/ScreenContainer';
import EmptyState from '../../components/ui/EmptyState';
import AnimatedListItem from '../../components/ui/AnimatedListItem';
import { getInventoryItems } from '../../api/inventory';
import type { InventoryItem } from '../../api/inventory';
import { getOutlets } from '../../api/outlets';
import { createTransaction } from '../../api/pos';
import { getFolios, type Folio } from '../../api/folios';
import { semantic } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import { useToast } from '../../components/ui/Toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarStackParamList, 'BarSale'>;

type CartEntry = { item: InventoryItem; qty: number };
type Cart = Map<string, CartEntry>;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные', icon: 'cash' },
  { value: 'card', label: 'Картой', icon: 'credit-card' },
  { value: 'transfer', label: 'Перевод', icon: 'bank-transfer' },
  { value: 'folio', label: 'На номер', icon: 'bed' },
] as const;

export default function BarSaleScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const activeShift = useShiftStore((s) => s.active);
  const refreshShift = useShiftStore((s) => s.refresh);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [barOutletId, setBarOutletId] = useState<string | null>(null);

  const [cart, setCart] = useState<Cart>(new Map());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [submitting, setSubmitting] = useState(false);

  // "На номер" (bill to room) — open folios to pick from.
  const [folios, setFolios] = useState<Folio[]>([]);
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);
  const isFolio = paymentMethod === 'folio';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, outlets, openFolios] = await Promise.all([
        getInventoryItems(),
        getOutlets(),
        getFolios('open').catch(() => [] as Folio[]),
      ]);
      setInventory(items.filter((i) => i.isActive));
      const bar = outlets.find((o) => o.type === 'bar');
      setBarOutletId(bar?.id ?? null);
      setFolios(openFolios);
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      refreshShift();
      load();
    }, [load, refreshShift]),
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of inventory) if (item.category) cats.add(item.category);
    return Array.from(cats).sort();
  }, [inventory]);

  const filtered = useMemo(() => {
    if (!activeCategory) return inventory;
    return inventory.filter((i) => i.category === activeCategory);
  }, [inventory, activeCategory]);

  const cartTotal = useMemo(() => {
    let total = 0;
    for (const e of cart.values()) total += e.qty * Number(e.item.price);
    return total;
  }, [cart]);

  const cartCount = useMemo(() => {
    let n = 0;
    for (const e of cart.values()) n += e.qty;
    return n;
  }, [cart]);

  const setQty = useCallback((item: InventoryItem, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      const newQty = (existing?.qty ?? 0) + delta;
      if (newQty <= 0) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, qty: newQty });
      }
      return next;
    });
  }, []);

  const handleCheckout = async () => {
    if (cart.size === 0) return;
    // Cash/card/transfer move money through the till → need an open shift.
    // Folio ("на номер") parks the bill on the guest's room → no shift needed.
    if (!isFolio && !activeShift) {
      Alert.alert('Нет открытой смены', 'Откройте смену перед продажей.');
      return;
    }
    if (isFolio && !selectedFolioId) {
      toast.show('Выберите номер (счёт)', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createTransaction({
        type: 'bar',
        employeeId: user?.id || '',
        employee: user?.fullName || '',
        total: cartTotal,
        paymentMethod,
        outletId: barOutletId,
        ...(isFolio ? { folioId: selectedFolioId } : {}),
        items: Array.from(cart.values()).map(({ item, qty }) => ({
          itemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: qty,
        })),
      });
      toast.show(isFolio ? 'Зачислено на номер' : 'Продажа оформлена', 'success');
      setCart(new Map());
      setSelectedFolioId(null);
      setCheckoutVisible(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось оформить продажу');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item, index }: { item: InventoryItem; index: number }) => {
    const entry = cart.get(item.id);
    const qty = entry?.qty ?? 0;
    const outOfStock = item.stock <= 0;

    return (
      <AnimatedListItem index={index} style={styles.cardWrap}>
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface, opacity: outOfStock ? 0.45 : 1 }]}
        elevation={1}
      >
        <View style={styles.cardTop}>
          <Text variant="bodyMedium" style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="titleSmall" style={[styles.price, { color: theme.colors.primary }]}>
            {Number(item.price).toFixed(0)} TJS
          </Text>
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
          {item.stock} {item.unit}
        </Text>
        {qty === 0 ? (
          <Button
            mode="contained-tonal"
            compact
            disabled={outOfStock}
            onPress={() => setQty(item, 1)}
          >
            {outOfStock ? 'Нет' : 'Добавить'}
          </Button>
        ) : (
          <View style={styles.qtyRow}>
            <IconButton
              icon="minus"
              size={18}
              mode="contained-tonal"
              onPress={() => setQty(item, -1)}
            />
            <Text variant="titleMedium" style={styles.qtyText}>{qty}</Text>
            <IconButton
              icon="plus"
              size={18}
              mode="contained-tonal"
              onPress={() => setQty(item, 1)}
            />
          </View>
        )}
      </Surface>
      </AnimatedListItem>
    );
  };

  return (
    <ScreenContainer>
      {/* Category filter */}
      <FlatList
        horizontal
        data={[null, ...categories]}
        keyExtractor={(c) => c ?? '__all__'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catList}
        renderItem={({ item: cat }) => (
          <Chip
            selected={activeCategory === cat}
            onPress={() => setActiveCategory(cat)}
            style={styles.cat}
            compact
          >
            {cat ?? 'Все'}
          </Chip>
        )}
      />

      {/* Items grid */}
      {loading ? null : filtered.length === 0 ? (
        <EmptyState icon="glass-cocktail" title="Нет товаров" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
        />
      )}

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <Surface style={[styles.cartBar, { backgroundColor: theme.colors.primaryContainer }]} elevation={4}>
          <View style={styles.cartInfo}>
            <Badge style={styles.badge}>{cartCount}</Badge>
            <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
              {cartTotal.toFixed(2)} TJS
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={() => setCheckoutVisible(true)}
          >
            Оплатить
          </Button>
        </Surface>
      )}

      {/* Checkout modal */}
      <Portal>
        <Modal
          visible={checkoutVisible}
          onDismiss={() => setCheckoutVisible(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Оформление продажи</Text>

          {/* Cart summary */}
          {Array.from(cart.values()).map(({ item, qty }) => (
            <View key={item.id} style={styles.cartRow}>
              <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{item.name}</Text>
              <Text variant="bodyMedium" style={{ opacity: 0.6, marginRight: 8 }}>×{qty}</Text>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {(qty * Number(item.price)).toFixed(2)}
              </Text>
            </View>
          ))}

          <Divider style={{ marginVertical: 12 }} />

          <View style={styles.cartRow}>
            <Text variant="titleMedium">Итого</Text>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
              {cartTotal.toFixed(2)} TJS
            </Text>
          </View>

          <Divider style={{ marginVertical: 12 }} />

          {/* Payment method */}
          <Text variant="labelLarge" style={{ marginBottom: 8 }}>Способ оплаты</Text>
          <View style={styles.paymentRow}>
            {PAYMENT_METHODS.map((pm) => (
              <Chip
                key={pm.value}
                selected={paymentMethod === pm.value}
                onPress={() => setPaymentMethod(pm.value)}
                icon={pm.icon}
                style={styles.pmChip}
              >
                {pm.label}
              </Chip>
            ))}
          </View>

          {/* Folio picker — only when billing to a room */}
          {isFolio && (
            <View style={styles.folioPicker}>
              <Text variant="labelLarge" style={{ marginBottom: 8 }}>Выберите номер</Text>
              {folios.length === 0 ? (
                <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                  Нет открытых счетов. Откройте фолио на ресепшене.
                </Text>
              ) : (
                <View style={styles.folioList}>
                  {folios.map((f) => {
                    const sel = selectedFolioId === f.id;
                    return (
                      <Chip
                        key={f.id}
                        selected={sel}
                        showSelectedCheck
                        icon="bed"
                        onPress={() => setSelectedFolioId(f.id)}
                        style={styles.folioChip}
                      >
                        {f.roomNumber != null ? `№ ${f.roomNumber}` : `Фолио ${f.id.slice(0, 6)}`}
                      </Chip>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <View style={styles.modalActions}>
            <Button onPress={() => setCheckoutVisible(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button
              mode="contained"
              onPress={handleCheckout}
              loading={submitting}
              disabled={submitting || (isFolio && !selectedFolioId)}
            >
              {isFolio ? 'Зачислить на номер' : 'Провести'}
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  catList: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  cat: { marginRight: 4 },
  grid: { padding: 12, paddingBottom: 100 },
  row: { gap: 12, marginBottom: 12 },
  cardWrap: { flex: 1 },
  card: { flex: 1, borderRadius: 12, padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  itemName: { flex: 1, fontWeight: '600', marginRight: 4 },
  price: { fontWeight: 'bold' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  qtyText: { minWidth: 28, textAlign: 'center', fontWeight: 'bold' },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { backgroundColor: semantic.error },
  modal: { margin: 20, borderRadius: 16, padding: 20 },
  modalTitle: { fontWeight: 'bold', marginBottom: 16 },
  cartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  paymentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  pmChip: {},
  folioPicker: { marginBottom: 16 },
  folioList: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  folioChip: {},
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
