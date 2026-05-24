import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import { Card, Text, Button, TextInput, Checkbox, useTheme, Divider } from 'react-native-paper';
import { getTransactions, createRefund } from '../../api/pos';
import { useAuthStore } from '../../store/authStore';
import { useManagerApproval } from '../../hooks/useManagerApproval';
import ManagerPinDialog from '../../components/ManagerPinDialog';
import { semantic } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { POSStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<POSStackParamList, 'Refund'>;

interface RefundItem {
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  selected: boolean;
}

export default function RefundScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { request: requestApproval, dialogProps } = useManagerApproval();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactions();
      setTransactions(data);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.id.toLowerCase().includes(q) ||
      (t.employee && t.employee.toLowerCase().includes(q))
    );
  });

  const selectTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setRefundItems(
      (transaction.items || []).map((item: any) => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        maxQuantity: item.quantity,
        selected: false,
      })),
    );
  };

  const toggleItem = (index: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item,
      ),
    );
  };

  const updateRefundQuantity = (index: number, qty: number) => {
    setRefundItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.min(Math.max(1, qty), item.maxQuantity) }
          : item,
      ),
    );
  };

  const selectedItems = refundItems.filter((item) => item.selected);
  const refundAmount = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const handleRefund = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Ошибка', 'Выберите позиции для возврата');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Ошибка', 'Укажите причину возврата');
      return;
    }

    requestApproval('Возврат', async (managerPin) => {
      setSubmitting(true);
      try {
        await createRefund({
          transactionId: selectedTransaction.id,
          items: selectedItems.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          amount: refundAmount,
          reason: reason.trim(),
          employeeId: user?.id || '',
          employeeName: user?.fullName || '',
          managerPin,
        });
        Alert.alert('Успех', 'Возврат оформлен', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setSubmitting(false);
      }
    });
  };

  // Transaction selection view
  if (!selectedTransaction) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TextInput
          placeholder="Поиск по номеру или сотруднику"
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          style={styles.searchInput}
          left={<TextInput.Icon icon="magnify" />}
        />

        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => selectTransaction(item)}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                    #{item.id.slice(0, 8)}
                  </Text>
                  <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                    {Number(item.total).toFixed(2)} TJS
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                  {item.employee} | {new Date(item.createdAt).toLocaleString('ru-RU')}
                </Text>
                <Text variant="bodySmall" style={{ opacity: 0.5, marginTop: 2 }}>
                  {(item.items || []).map((i: any) => i.name).join(', ')}
                </Text>
              </Card.Content>
            </Card>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text variant="bodyLarge" style={{ opacity: 0.5 }}>
                  Нет транзакций
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    );
  }

  // Refund form view
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.formContent}
    >
      {/* Transaction header */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
            Транзакция #{selectedTransaction.id.slice(0, 8)}
          </Text>
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>
            {selectedTransaction.employee} |{' '}
            {new Date(selectedTransaction.createdAt).toLocaleString('ru-RU')}
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: 4 }}>
            Сумма: {Number(selectedTransaction.total).toFixed(2)} TJS
          </Text>
        </Card.Content>
      </Card>

      {/* Items to refund */}
      <Text variant="titleSmall" style={styles.sectionTitle}>
        Выберите позиции для возврата:
      </Text>

      {refundItems.map((item, index) => (
        <Card key={index} style={styles.refundItemCard}>
          <Card.Content style={styles.refundItemContent}>
            <Checkbox
              status={item.selected ? 'checked' : 'unchecked'}
              onPress={() => toggleItem(index)}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{item.name}</Text>
              <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                {item.price.toFixed(2)} TJS x {item.quantity} = {(item.price * item.quantity).toFixed(2)} TJS
              </Text>
            </View>
            {item.selected && item.maxQuantity > 1 && (
              <View style={styles.qtyControls}>
                <Button
                  compact
                  mode="text"
                  onPress={() => updateRefundQuantity(index, item.quantity - 1)}
                >
                  -
                </Button>
                <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{item.quantity}</Text>
                <Button
                  compact
                  mode="text"
                  onPress={() => updateRefundQuantity(index, item.quantity + 1)}
                >
                  +
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>
      ))}

      {/* Reason */}
      <TextInput
        label="Причина возврата"
        value={reason}
        onChangeText={setReason}
        mode="outlined"
        multiline
        numberOfLines={3}
        style={styles.reasonInput}
      />

      {/* Refund summary */}
      {selectedItems.length > 0 && (
        <>
          <Divider style={{ marginVertical: 12 }} />
          <View style={styles.summaryRow}>
            <Text variant="titleMedium">Сумма возврата:</Text>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: semantic.error }}>
              {refundAmount.toFixed(2)} TJS
            </Text>
          </View>
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => setSelectedTransaction(null)}
          style={[styles.actionButton, { marginRight: 8 }]}
        >
          Назад
        </Button>
        <Button
          mode="contained"
          onPress={handleRefund}
          loading={submitting}
          disabled={submitting || selectedItems.length === 0 || !reason.trim()}
          style={styles.actionButton}
          buttonColor={semantic.error}
        >
          Оформить возврат
        </Button>
      </View>
      <ManagerPinDialog {...dialogProps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchInput: { margin: 12 },
  list: { padding: 12, paddingBottom: 20 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  formContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  refundItemCard: { marginBottom: 6, borderRadius: 10 },
  refundItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonInput: { marginTop: 16 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  actionButton: { flex: 1, borderRadius: 8 },
});
