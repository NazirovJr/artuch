import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Card, Text, TextInput, Button, Divider, useTheme } from 'react-native-paper';
import { getFolio, addPayment, closeFolio } from '../../api/folios';
import { semantic } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RoomsStackParamList, 'FolioClose'>;

export default function CloseFolioScreen({ route, navigation }: Props) {
  const { folioId } = route.params;
  const theme = useTheme();
  const [folio, setFolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchFolio = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFolio(folioId);
      setFolio(data);
      const balance = Number(data.totalAmount || 0) - Number(data.paidAmount || 0);
      if (balance > 0) {
        setPaymentAmount(balance.toFixed(2));
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [folioId]);

  useEffect(() => {
    fetchFolio();
  }, [fetchFolio]);

  if (loading || !folio) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>{loading ? 'Загрузка...' : 'Фолио не найдено'}</Text>
      </View>
    );
  }

  const totalAmount = Number(folio.totalAmount || 0);
  const paidAmount = Number(folio.paidAmount || 0);
  const balance = totalAmount - paidAmount;

  const handlePayAndClose = async () => {
    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму оплаты');
      return;
    }

    setSubmitting(true);
    try {
      if (numAmount > 0) {
        await addPayment(folioId, {
          amount: numAmount,
          description: 'Оплата при закрытии',
        });
      }
      await closeFolio(folioId);
      // Jump to the receipt instead of the list — reception needs the
      // printable chit right now, not two taps later. `replace` clears
      // this close-screen from the back-stack.
      navigation.replace('FolioReceipt', { folioId });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось закрыть фолио');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseWithoutPayment = async () => {
    Alert.alert(
      'Закрыть без оплаты',
      `Остаток ${balance.toFixed(2)} TJS не будет оплачен. Продолжить?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await closeFolio(folioId);
              navigation.replace('FolioReceipt', { folioId });
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось закрыть фолио');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Summary */}
      <Card style={styles.card}>
        <Card.Title title="Итого по фолио" />
        <Card.Content>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium">Начислено</Text>
            <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
              {totalAmount.toFixed(2)} TJS
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium">Оплачено</Text>
            <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: semantic.success }}>
              {paidAmount.toFixed(2)} TJS
            </Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>К оплате</Text>
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', color: balance > 0 ? semantic.error : semantic.success }}
            >
              {balance.toFixed(2)} TJS
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Payment form */}
      {balance > 0 && (
        <Card style={styles.card}>
          <Card.Title title="Оплата" />
          <Card.Content>
            <TextInput
              label="Сумма оплаты (TJS)"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handlePayAndClose}
              loading={submitting}
              disabled={submitting}
              style={[styles.button, { backgroundColor: semantic.success }]}
            >
              Оплатить и закрыть
            </Button>

            <Button
              mode="outlined"
              onPress={handleCloseWithoutPayment}
              disabled={submitting}
              style={styles.button}
              textColor={semantic.error}
            >
              Закрыть без оплаты
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { margin: 12, marginBottom: 0, borderRadius: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  divider: { marginVertical: 8 },
  input: { marginBottom: 16 },
  button: { marginBottom: 8, borderRadius: 8 },
});
