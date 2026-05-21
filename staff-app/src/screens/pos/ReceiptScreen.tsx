import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Divider, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { POSStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<POSStackParamList, 'Receipt'>;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  mobile: 'QR',
};

export default function ReceiptScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { transaction } = route.params;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Success header */}
      <View style={styles.successHeader}>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
          Оплата проведена
        </Text>
        <Text variant="bodySmall" style={{ opacity: 0.5, marginTop: 4 }}>
          {new Date(transaction.createdAt).toLocaleString('ru-RU')}
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          {/* Transaction info */}
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Сотрудник:</Text>
            <Text variant="bodyMedium">{transaction.employee}</Text>
          </View>
          {transaction.outletId && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Точка:</Text>
              <Text variant="bodyMedium">{transaction.outletId}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Оплата:</Text>
            <Text variant="bodyMedium">
              {PAYMENT_LABELS[transaction.paymentMethod] || transaction.paymentMethod}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Items */}
          <Text variant="titleSmall" style={{ marginBottom: 8, fontWeight: 'bold' }}>
            Позиции
          </Text>
          {(transaction.items || []).map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{item.name}</Text>
                <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                  {Number(item.price).toFixed(2)} x {item.quantity}
                </Text>
              </View>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {(Number(item.price) * item.quantity).toFixed(2)} TJS
              </Text>
            </View>
          ))}

          <Divider style={styles.divider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Итого:</Text>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
              {Number(transaction.total).toFixed(2)} TJS
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={() => navigation.popToTop()}
        style={styles.button}
        contentStyle={{ paddingVertical: 6 }}
      >
        Новая продажа
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  successHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
  },
  card: { borderRadius: 12, marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: { opacity: 0.6, marginRight: 8, minWidth: 100 },
  divider: { marginVertical: 12 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: { borderRadius: 8 },
});
