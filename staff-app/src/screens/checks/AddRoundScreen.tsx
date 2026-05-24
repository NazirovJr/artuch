import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, SectionList, StyleSheet, Alert } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Card,
  List,
  IconButton,
  Chip,
  useTheme,
} from 'react-native-paper';
import { getMenu } from '../../api/menu';
import { addRound } from '../../api/checks';
import { semantic, roleColors } from '../../theme/colors';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import ScreenContainer from '../../components/ui/ScreenContainer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'AddRound'>;

interface CartItem {
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes: string;
  station: string;
}

const STATION_META: Record<string, { label: string; color: string }> = {
  kitchen: { label: 'Кухня', color: semantic.warning },
  bar: { label: 'Бар', color: roleColors.barman },
  none: { label: 'Сам', color: semantic.success },
};

export default function AddRoundScreen({ route, navigation }: Props) {
  const { checkId, tableNumber } = route.params;
  const theme = useTheme();
  const { menuItems, setMenuItems } = useOrderStore();
  const { user } = useAuthStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoadingMenu(true);
    try {
      setMenuItems(await getMenu());
    } catch {
      // silent; pull-to-retry via re-mount
    } finally {
      setLoadingMenu(false);
    }
  }, [setMenuItems]);

  useEffect(() => {
    if (menuItems.length === 0) fetchMenu();
  }, [fetchMenu, menuItems.length]);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          menuItemName: item.nameRu || item.name,
          menuItemPrice: Number(item.price),
          quantity: 1,
          notes: '',
          station: item.station || 'kitchen',
        },
      ];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === menuItemId);
      if (existing && existing.quantity > 1) {
        return prev.map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c,
        );
      }
      return prev.filter((c) => c.menuItemId !== menuItemId);
    });
  };

  const updateNotes = (menuItemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItemId === menuItemId ? { ...c, notes } : c)),
    );
  };

  const total = cart.reduce((s, i) => s + i.menuItemPrice * i.quantity, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Ошибка', 'Добавьте хотя бы одну позицию');
      return;
    }
    setSubmitting(true);
    try {
      await addRound(checkId, {
        waiterName: user?.fullName,
        items: cart.map(({ menuItemId, menuItemName, menuItemPrice, quantity, notes }) => ({
          menuItemId,
          menuItemName,
          menuItemPrice,
          quantity,
          notes: notes || null,
        })),
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось отправить заказ');
    } finally {
      setSubmitting(false);
    }
  };

  const sections = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const item of menuItems) {
      const cat = item.category || 'other';
      (grouped[cat] ||= []).push(item);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [menuItems]);

  const getQty = (id: string) => cart.find((c) => c.menuItemId === id)?.quantity || 0;

  return (
    <ScreenContainer maxWidth="reading">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            Стол {tableNumber}
          </Text>
          <View style={styles.totalBox}>
            <Text variant="bodySmall" style={{ opacity: 0.6 }}>В заказе</Text>
            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {total.toFixed(2)} TJS
            </Text>
          </View>
        </View>

        {cart.length > 0 && (
          <Card style={styles.cartCard}>
            <Card.Content>
              <Text variant="titleSmall" style={{ marginBottom: 6 }}>
                Текущий подход ({cart.length})
              </Text>
              {cart.map((item) => (
                <View key={item.menuItemId} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">
                      {item.menuItemName} ×{item.quantity}
                    </Text>
                    <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                      {(item.menuItemPrice * item.quantity).toFixed(2)} TJS · {STATION_META[item.station]?.label ?? item.station}
                    </Text>
                  </View>
                  <TextInput
                    placeholder="Заметка"
                    value={item.notes}
                    onChangeText={(t) => updateNotes(item.menuItemId, t)}
                    mode="flat"
                    dense
                    style={styles.noteInput}
                  />
                  <IconButton icon="minus" size={18} onPress={() => removeFromCart(item.menuItemId)} />
                  <IconButton icon="plus" size={18} onPress={() => addToCart({ id: item.menuItemId, nameRu: item.menuItemName, price: item.menuItemPrice, station: item.station })} />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <Text variant="titleSmall" style={styles.sectionHeader}>
              {title}
            </Text>
          )}
          renderItem={({ item }) => {
            const qty = getQty(item.id);
            const st = STATION_META[item.station || 'kitchen'];
            return (
              <List.Item
                title={item.nameRu || item.name}
                description={`${Number(item.price).toFixed(2)} TJS`}
                onPress={() => addToCart(item)}
                left={() => (
                  <Chip compact style={[styles.stationChip, { backgroundColor: st?.color }]} textStyle={styles.stationText}>
                    {st?.label}
                  </Chip>
                )}
                right={() =>
                  qty > 0 ? (
                    <View style={[styles.qtyBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.qtyText}>{qty}</Text>
                    </View>
                  ) : null
                }
                style={styles.menuItem}
              />
            );
          }}
          contentContainerStyle={styles.menuList}
          ListEmptyComponent={
            loadingMenu ? (
              <Text style={styles.loadingText}>Загрузка меню…</Text>
            ) : null
          }
        />

        <Button
          mode="contained"
          icon="send"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || cart.length === 0}
          style={styles.submitButton}
        >
          Отправить заказ
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', padding: 12, alignItems: 'center', justifyContent: 'space-between' },
  totalBox: { alignItems: 'flex-end' },
  cartCard: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12 },
  cartItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  noteInput: { width: 90, fontSize: 12 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontWeight: 'bold',
    textTransform: 'capitalize',
    opacity: 0.7,
  },
  menuList: { paddingBottom: 80 },
  menuItem: { paddingHorizontal: 16 },
  stationChip: { alignSelf: 'center', marginLeft: 8 },
  stationText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  qtyBadge: {
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  qtyText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  loadingText: { textAlign: 'center', marginTop: 24, opacity: 0.5 },
  submitButton: { margin: 12, borderRadius: 8 },
});
