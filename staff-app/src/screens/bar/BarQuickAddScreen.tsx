import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  IconButton,
  Searchbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import EmptyState from '../../components/ui/EmptyState';
import { getInventoryItems, type InventoryItem } from '../../api/inventory';
import { addRound } from '../../api/checks';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import type { BarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarStackParamList, 'BarQuickAdd'>;

export default function BarQuickAddScreen({ route, navigation }: Props) {
  const { checkId } = route.params;
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getInventoryItems()
      .then((all) => setItems(all.filter((i) => i.isActive && i.stock > 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const cartTotal = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [id, qty]) => {
        const item = items.find((i) => i.id === id);
        return sum + (item ? item.price * qty : 0);
      }, 0),
    [cart, items],
  );

  const cartCount = useMemo(
    () => Object.values(cart).reduce((s, v) => s + v, 0),
    [cart],
  );

  const setQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = (prev[id] || 0) + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleAdd = useCallback(async () => {
    if (cartCount === 0) return;
    setSaving(true);
    try {
      const roundItems = Object.entries(cart).map(([id, qty]) => {
        const item = items.find((i) => i.id === id)!;
        return {
          menuItemId: id,           // backend accepts inventory id here
          menuItemName: item.name,
          menuItemPrice: item.price,
          quantity: qty,
          station: 'none' as const, // bypass KDS — direct to served
        };
      });
      await addRound(checkId, {
        items: roundItems as any,
        waiterName: user?.fullName || user?.username,
      });
      toast.show('Позиции добавлены в счёт', 'success');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось добавить');
    } finally {
      setSaving(false);
    }
  }, [cart, cartCount, checkId, items, navigation, toast, user]);

  return (
    <ScreenContainer>
      <Searchbar
        placeholder="Поиск напитков…"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="bottle-wine" title="Нет позиций" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const qty = cart[item.id] || 0;
            return (
              <Surface
                style={[styles.card, { backgroundColor: theme.colors.surface }]}
                elevation={1}
              >
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{item.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.price.toFixed(2)} TJS · ост. {item.stock} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.qty}>
                    <IconButton icon="minus" size={18} onPress={() => setQty(item.id, -1)} disabled={qty === 0} />
                    <Text variant="titleSmall" style={{ minWidth: 20, textAlign: 'center' }}>{qty}</Text>
                    <IconButton icon="plus" size={18} onPress={() => setQty(item.id, 1)} />
                  </View>
                </View>
              </Surface>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          contentContainerStyle={styles.list}
        />
      )}

      {cartCount > 0 && (
        <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button
            mode="contained"
            loading={saving}
            disabled={saving}
            onPress={handleAdd}
            icon="check"
          >
            Добавить {cartCount} поз. · {cartTotal.toFixed(2)} TJS
          </Button>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: { margin: 12 },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  card: { borderRadius: 10, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  qty: { flexDirection: 'row', alignItems: 'center' },
  footer: { padding: 12, borderTopWidth: 1 },
});
