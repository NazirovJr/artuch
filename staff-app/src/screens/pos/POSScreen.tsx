import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, Chip, Button, Badge, useTheme, IconButton } from 'react-native-paper';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { getInventoryItems as getInventory } from '../../api/inventory';
import { usePosStore } from '../../store/posStore';
import { useAuthStore } from '../../store/authStore';
import { useShiftStore } from '../../store/shiftStore';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { useToast } from '../../components/ui/Toast';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { rv } from '../../utils/responsive';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { POSStackParamList } from '../../navigation/types';

/** @deprecated Use POSStackParamList from navigation/types instead */
export type PosStackParamList = POSStackParamList;

type Props = NativeStackScreenProps<POSStackParamList, 'POS'>;

export default function POSScreen({ navigation }: Props) {
  const theme = useTheme();
  const { cart, currentOutlet, addToCart } = usePosStore();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const toast = useToast();
  const activeShift = useShiftStore((s) => s.active);
  const refreshShift = useShiftStore((s) => s.refresh);
  const shiftLoading = useShiftStore((s) => s.loading);

  // Responsive grid: 2 cols on phones → up to 6 on wide desktop. Changing
  // numColumns on the fly requires a fresh `key` to force FlatList re-init,
  // otherwise RN throws "Changing numColumns on the fly is not supported".
  const { bp } = useBreakpoint();
  const numColumns = rv({ phone: 2, tablet: 3, desktop: 4, wide: 6 }, bp);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInventory();
      setInventory(data);
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить товары', 'error');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [toast]);

  // Refresh inventory + shift every time the screen comes into focus so that
  // stock counts are up-to-date after a completed sale or a receive-from-warehouse.
  useFocusEffect(
    useCallback(() => {
      refreshShift();
      fetchInventory();
    }, [fetchInventory, refreshShift]),
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of inventory) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [inventory]);

  const filteredItems = useMemo(() => {
    if (!activeCategory) return inventory;
    return inventory.filter((item) => item.category === activeCategory);
  }, [inventory, activeCategory]);

  const cartTotal = usePosStore((s) => s.getTotal());
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const getCartQuantity = (id: string) => {
    const item = cart.find((i) => i.id === id);
    return item?.quantity || 0;
  };

  const handleAddToCart = (item: any) => {
    addToCart({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: 1,
    });
  };

  const renderProduct = ({ item, index }: { item: any; index: number }) => {
    const qty = getCartQuantity(item.id);
    return (
      <Animated.View entering={FadeInUp.delay(index * 40).springify()} style={styles.productWrapper}>
        <Card style={styles.productCard} onPress={() => handleAddToCart(item)}>
          <Card.Content style={styles.productContent}>
            <Text variant="bodyMedium" numberOfLines={2} style={styles.productName}>
              {item.name}
            </Text>
            <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {Number(item.price).toFixed(2)} TJS
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Остаток: {item.stock}
            </Text>
            {qty > 0 && (
              <Badge style={[styles.qtyBadge, { backgroundColor: theme.colors.primary }]}>{qty}</Badge>
            )}
          </Card.Content>
        </Card>
      </Animated.View>
    );
  };

  if (initialLoad && (loading || shiftLoading)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LoadingSkeleton count={6} />
      </View>
    );
  }

  if (!activeShift) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, padding: 16, justifyContent: 'center' },
        ]}
      >
        <EmptyState
          icon="cash-register"
          title="Смена закрыта"
          subtitle="Откройте смену, чтобы начать продажи. Все операции будут привязаны к смене для сверки кассы."
        />
        <Button
          mode="contained"
          icon="play"
          onPress={() => navigation.navigate('ShiftOpen')}
          style={{ marginTop: 16, borderRadius: 8 }}
        >
          Открыть смену
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header: outlet name + actions */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            {currentOutlet?.name || 'Точка продажи'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            Смена открыта · {Number(activeShift.openingCash).toFixed(2)} TJS
          </Text>
        </View>
        <IconButton
          icon="history"
          size={22}
          onPress={() => navigation.navigate('TransactionHistory')}
        />
        <IconButton
          icon="cash-refund"
          size={22}
          onPress={() => navigation.navigate('Refund')}
        />
        <IconButton
          icon="cash-lock"
          size={22}
          onPress={() => navigation.navigate('ShiftClose', { shiftId: activeShift.id })}
        />
      </View>

      {/* Category filter chips */}
      <View style={styles.filterRow}>
        <Chip
          selected={!activeCategory}
          onPress={() => setActiveCategory(undefined)}
          style={styles.filterChip}
          compact
        >
          Все
        </Chip>
        {categories.map((cat) => (
          <Chip
            key={cat}
            selected={activeCategory === cat}
            onPress={() => setActiveCategory(cat)}
            style={styles.filterChip}
            compact
          >
            {cat}
          </Chip>
        ))}
      </View>

      {/* Product grid */}
      <FlatList
        key={`pos-grid-${numColumns}`}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={numColumns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchInventory} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cart-off"
              title="Нет товаров"
              subtitle="Загрузите каталог или измените фильтр"
            />
          ) : null
        }
      />

      {/* Bottom bar: cart summary */}
      {cartCount > 0 && (
        <View style={[styles.bottomBar, { backgroundColor: theme.colors.primaryContainer }]}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">
              {cartCount} шт. в корзине
            </Text>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
              {cartTotal.toFixed(2)} TJS
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Cart')}
            style={{ borderRadius: 8 }}
          >
            Корзина
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: { marginBottom: 4 },
  list: { padding: 6, paddingBottom: 100 },
  row: { justifyContent: 'space-between', paddingHorizontal: 6 },
  productWrapper: {
    flex: 1,
    margin: 6,
    // No maxWidth — flex distributes width equally across `numColumns`,
    // which we now compute from the breakpoint.
  },
  productCard: {
    borderRadius: 12,
  },
  productContent: {
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  productName: {
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '600',
  },
  qtyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    color: '#fff',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
