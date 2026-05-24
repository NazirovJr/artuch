import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Text, Button, IconButton, useTheme, SegmentedButtons } from 'react-native-paper';
import { usePosStore, type PaymentMethod } from '../../store/posStore';
import { useAuthStore } from '../../store/authStore';
import { createTransaction } from '../../api/pos';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { POSStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<POSStackParamList, 'Cart'>;

// Base payment options — always present. `folio` gets appended below only
// when the current outlet is configured to accept room-bill charges.
const BASE_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
  { value: 'mobile', label: 'QR' },
];

export default function CartScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const {
    cart,
    currentOutlet,
    paymentMethod,
    selectedFolioId,
    selectedFolioMeta,
    updateQuantity,
    removeFromCart,
    clearCart,
    setPaymentMethod,
  } = usePosStore();
  const total = usePosStore((s) => s.getTotal());
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  // "Bill to room" is offered everywhere — bar, shop, restaurant, rental.
  // Any outlet on the property can post onto a guest's folio; whether a
  // specific sale actually gets billed to the room is the cashier's call,
  // not a configuration flag. (Historical `outlet.supportsFolio` flag is
  // no longer consulted here — it was a guardrail that hid a legitimate
  // workflow more often than it prevented mistakes.)
  const paymentButtons: { value: PaymentMethod; label: string }[] = [
    ...BASE_METHODS,
    { value: 'folio', label: 'На счёт' },
  ];

  const isFolioMode = paymentMethod === 'folio';
  const folioPicked = isFolioMode && !!selectedFolioId;

  const handlePay = async () => {
    if (cart.length === 0) {
      toast.error('Корзина пуста');
      return;
    }
    if (isFolioMode && !selectedFolioId) {
      // Shouldn't happen — the CTA routes to the picker first — but guard
      // just in case.
      toast.warning('Сначала выберите счёт');
      return;
    }

    setSubmitting(true);
    try {
      const transaction = await createTransaction({
        type: currentOutlet?.type || 'shop',
        employeeId: user?.id || '',
        employee: user?.fullName || '',
        total,
        paymentMethod,
        outletId: currentOutlet?.id || null,
        ...(isFolioMode ? { folioId: selectedFolioId } : {}),
        items: cart.map((item) => ({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          volume: item.volume || null,
        })),
      });
      clearCart();
      if (isFolioMode) {
        const roomHint = selectedFolioMeta?.roomNumber
          ? `#${selectedFolioMeta.roomNumber}`
          : '';
        toast.success(`Зачислено на счёт ${roomHint}`.trim(), `${total.toFixed(0)} TJS`);
      } else {
        toast.success('Оплата прошла успешно');
      }
      navigation.replace('Receipt', { transaction });
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось провести оплату');
    } finally {
      setSubmitting(false);
    }
  };

  // Button label + handler depend on the payment mode. In folio mode with
  // no pick yet, we route to the picker instead of firing the POST.
  const payButtonLabel = isFolioMode
    ? folioPicked
      ? `Зачислить на счёт${
          selectedFolioMeta?.roomNumber ? ' #' + selectedFolioMeta.roomNumber : ''
        } · ${total.toFixed(0)} TJS`
      : 'Выбрать счёт'
    : `Оплатить ${total.toFixed(2)} TJS`;
  const payButtonIcon = isFolioMode
    ? folioPicked
      ? 'check'
      : 'magnify'
    : undefined;
  const payButtonOnPress = isFolioMode && !folioPicked
    ? () => navigation.navigate('FolioPicker')
    : handlePay;

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge" style={{ fontWeight: '600' }}>{item.name}</Text>
          <Text variant="bodySmall" style={{ opacity: 0.5 }}>
            {Number(item.price).toFixed(2)} TJS x {item.quantity}
          </Text>
        </View>
        <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold', marginRight: 8 }}>
          {(item.price * item.quantity).toFixed(2)}
        </Text>
        <View style={styles.qtyControls}>
          <IconButton
            icon="minus"
            size={18}
            onPress={() => {
              if (item.quantity <= 1) {
                removeFromCart(item.id);
              } else {
                updateQuantity(item.id, item.quantity - 1);
              }
            }}
          />
          <Text variant="bodyLarge" style={{ fontWeight: 'bold', minWidth: 24, textAlign: 'center' }}>
            {item.quantity}
          </Text>
          <IconButton
            icon="plus"
            size={18}
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
          />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={cart}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="cart-outline"
            title="Корзина пуста"
            subtitle="Добавьте товары из каталога"
          />
        }
      />

      {cart.length > 0 && (
        <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
          {/* Subtotal */}
          <View style={styles.totalRow}>
            <Text variant="titleMedium">Итого:</Text>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
              {total.toFixed(2)} TJS
            </Text>
          </View>

          {/* Payment method */}
          <Text variant="bodyMedium" style={{ marginBottom: 8, opacity: 0.7 }}>
            Способ оплаты:
          </Text>
          <SegmentedButtons
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            buttons={paymentButtons.map((m) => ({ value: m.value, label: m.label }))}
            style={styles.segmented}
          />

          {/* Folio summary card — visible once a folio is picked. Gives the
              cashier a chance to double-check the room before committing. */}
          {isFolioMode && folioPicked && (
            <View style={[styles.folioSummary, { backgroundColor: theme.colors.primaryContainer }]}>
              <View style={{ flex: 1 }}>
                <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                  Счёт выбран
                </Text>
                <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                  {selectedFolioMeta?.roomNumber
                    ? `Номер #${selectedFolioMeta.roomNumber}`
                    : 'Без номера'}
                  {selectedFolioMeta?.guestName ? ` · ${selectedFolioMeta.guestName}` : ''}
                </Text>
              </View>
              <Button
                compact
                mode="text"
                onPress={() => navigation.navigate('FolioPicker')}
                textColor={theme.colors.onPrimaryContainer}
              >
                Сменить
              </Button>
            </View>
          )}

          {/* Pay button */}
          <Button
            mode="contained"
            icon={payButtonIcon}
            onPress={payButtonOnPress}
            loading={submitting}
            disabled={submitting || cart.length === 0}
            style={styles.payButton}
            contentStyle={{ paddingVertical: 6 }}
          >
            {payButtonLabel}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 20 },
  card: { marginBottom: 8, borderRadius: 12 },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  segmented: { marginBottom: 16 },
  folioSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  payButton: { borderRadius: 8 },
});
