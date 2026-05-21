import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, SectionList } from 'react-native';
import { TextInput, Button, Text, Card, List, IconButton, useTheme } from 'react-native-paper';
import { getMenu } from '../../api/menu';
import { createOrder } from '../../api/orders';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ui/ScreenContainer';

type Props = NativeStackScreenProps<OrdersStackParamList, 'NewOrder'>;

interface CartItem {
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes: string;
}

export default function NewOrderScreen({ navigation }: Props) {
  const { menuItems, setMenuItems } = useOrderStore();
  const { user } = useAuthStore();
  const theme = useTheme();

  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoadingMenu(true);
    try {
      const data = await getMenu();
      setMenuItems(data);
    } catch {
      // handle error silently
    } finally {
      setLoadingMenu(false);
    }
  }, [setMenuItems]);

  useEffect(() => {
    if (menuItems.length === 0) {
      fetchMenu();
    }
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

  const total = cart.reduce((sum, item) => sum + item.menuItemPrice * item.quantity, 0);

  const handleSubmit = async () => {
    const table = tableNumber.trim().toUpperCase();
    if (!table) {
      Alert.alert('Ошибка', 'Укажите номер стола');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Ошибка', 'Добавьте хотя бы одно блюдо');
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({
        tableNumber: table,
        waiterId: user?.id || '',
        waiterName: user?.fullName || '',
        total,
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
      Alert.alert('Ошибка', e.message || 'Не удалось создать заказ');
    } finally {
      setSubmitting(false);
    }
  };

  // Group menu items by category
  const sections = React.useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const item of menuItems) {
      const cat = item.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [menuItems]);

  const getCartQuantity = (menuItemId: string) => {
    const item = cart.find((c) => c.menuItemId === menuItemId);
    return item?.quantity || 0;
  };

  return (
    <ScreenContainer maxWidth="reading">
      <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          label="Номер стола"
          value={tableNumber}
          onChangeText={setTableNumber}
          autoCapitalize="characters"
          maxLength={20}
          mode="outlined"
          style={styles.tableInput}
        />
        <View style={styles.totalBox}>
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>Итого</Text>
          <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {total.toFixed(2)} TJS
          </Text>
        </View>
      </View>

      {/* Cart summary */}
      {cart.length > 0 && (
        <Card style={styles.cartCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ marginBottom: 6 }}>
              Корзина ({cart.length})
            </Text>
            {cart.map((item) => (
              <View key={item.menuItemId} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{item.menuItemName} x{item.quantity}</Text>
                  <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                    {(item.menuItemPrice * item.quantity).toFixed(2)} TJS
                  </Text>
                </View>
                <TextInput
                  placeholder="Заметка"
                  value={item.notes}
                  onChangeText={(text) => updateNotes(item.menuItemId, text)}
                  mode="flat"
                  dense
                  style={styles.noteInput}
                />
                <IconButton icon="minus" size={18} onPress={() => removeFromCart(item.menuItemId)} />
                <IconButton icon="plus" size={18} onPress={() => addToCart({ id: item.menuItemId, nameRu: item.menuItemName, price: item.menuItemPrice })} />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Menu items grouped by category */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Text variant="titleSmall" style={styles.sectionHeader}>
            {title}
          </Text>
        )}
        renderItem={({ item }) => {
          const qty = getCartQuantity(item.id);
          return (
            <List.Item
              title={item.nameRu || item.name}
              description={`${Number(item.price).toFixed(2)} TJS`}
              onPress={() => addToCart(item)}
              right={() =>
                qty > 0 ? (
                  <View style={styles.qtyBadge}>
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
            <Text style={{ textAlign: 'center', marginTop: 24, opacity: 0.5 }}>
              Загрузка меню...
            </Text>
          ) : null
        }
      />

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting || cart.length === 0 || !tableNumber}
        style={styles.submitButton}
      >
        Создать заказ
      </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  tableInput: { flex: 1 },
  totalBox: { alignItems: 'flex-end' },
  cartCard: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
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
  qtyBadge: {
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  qtyText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  submitButton: {
    margin: 12,
    borderRadius: 8,
  },
});
