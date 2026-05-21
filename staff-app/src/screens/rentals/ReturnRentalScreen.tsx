import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Card,
  Divider,
  SegmentedButtons,
  useTheme,
} from 'react-native-paper';
import { getRental, returnRental } from '../../api/rentals';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WarehouseStackParamList } from '../../navigation/types';
import { moneyInputFilter, maskMoney, unmaskMoney } from '../../utils/inputMask';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'ReturnRental'>;

export default function ReturnRentalScreen({ route, navigation }: Props) {
  const { rentalId } = route.params;
  const theme = useTheme();

  const [rental, setRental] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [condition, setCondition] = useState('good');
  const [damageNote, setDamageNote] = useState('');
  const [damageFee, setDamageFee] = useState('');

  const fetchRental = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRental(rentalId);
      setRental(data);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  useEffect(() => {
    fetchRental();
  }, [fetchRental]);

  const actualDays = rental
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(rental.issuedAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  const baseCharge = rental
    ? Number(rental.pricePerDay) * actualDays * rental.quantity
    : 0;

  const totalCharge =
    baseCharge + (condition === 'damaged' ? parseFloat(unmaskMoney(damageFee)) || 0 : 0);

  const handleReturn = async () => {
    setSubmitting(true);
    try {
      await returnRental(rentalId, {
        condition,
        damageNote: condition === 'damaged' ? damageNote : undefined,
        damageFee: condition === 'damaged' ? parseFloat(unmaskMoney(damageFee)) || 0 : undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось оформить возврат');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  if (!rental) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Аренда не найдена</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.infoCard}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>
            {rental.itemName}
          </Text>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Количество</Text>
            <Text variant="bodyMedium">{rental.quantity}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Цена/день</Text>
            <Text variant="bodyMedium">{Number(rental.pricePerDay).toFixed(2)} TJS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Выдано</Text>
            <Text variant="bodyMedium">
              {new Date(rental.issuedAt).toLocaleDateString('ru-RU')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Ожидаемый возврат</Text>
            <Text variant="bodyMedium">
              {new Date(rental.expectedReturn).toLocaleDateString('ru-RU')}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Фактических дней</Text>
            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{actualDays}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Базовая сумма</Text>
            <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {baseCharge.toFixed(2)} TJS
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Состояние
      </Text>

      <SegmentedButtons
        value={condition}
        onValueChange={setCondition}
        buttons={[
          { value: 'good', label: 'Хорошее' },
          { value: 'damaged', label: 'Повреждено' },
        ]}
        style={styles.segmented}
      />

      {condition === 'damaged' && (
        <>
          <TextInput
            label="Описание повреждения"
            value={damageNote}
            onChangeText={setDamageNote}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          <TextInput
            label="Штраф за повреждение (TJS)"
            value={damageFee}
            onChangeText={(v) => setDamageFee(moneyInputFilter(v))}
            onBlur={() => damageFee && setDamageFee(maskMoney(damageFee))}
            onFocus={() => setDamageFee(unmaskMoney(damageFee))}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
          />
        </>
      )}

      <Card style={styles.totalCard}>
        <Card.Content style={styles.totalRow}>
          <Text variant="titleMedium">Итого к оплате</Text>
          <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            {totalCharge.toFixed(2)} TJS
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleReturn}
        loading={submitting}
        disabled={submitting}
        style={styles.submitButton}
      >
        Подтвердить возврат
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  infoCard: { borderRadius: 12, marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { opacity: 0.6 },
  divider: { marginVertical: 12 },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  segmented: { marginBottom: 12 },
  input: { marginBottom: 12 },
  totalCard: {
    borderRadius: 12,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitButton: {
    borderRadius: 8,
  },
});
