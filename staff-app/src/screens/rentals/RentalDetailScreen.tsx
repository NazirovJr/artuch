import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  Divider,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { getRental, extendRental } from '../../api/rentals';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WarehouseStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { maskDate } from '../../utils/inputMask';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'RentalDetail'>;

export default function RentalDetailScreen({ route, navigation }: Props) {
  const { rentalId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const [rental, setRental] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [newDate, setNewDate] = useState('');

  const fetchRental = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRental(rentalId);
      setRental(data);
    } catch (e: any) {
      toast.show(e.message || 'Ошибка', 'error');
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  useEffect(() => {
    fetchRental();
  }, [fetchRental]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRental();
    });
    return unsubscribe;
  }, [navigation, fetchRental]);

  const isOverdue =
    rental?.status === 'active' && new Date(rental.expectedReturn) < new Date();

  const getEffectiveStatus = () => {
    if (isOverdue) return 'overdue';
    return rental?.status;
  };

  const handleExtend = async () => {
    if (!newDate.trim()) {
      Alert.alert('Ошибка', 'Укажите новую дату (ГГГГ-ММ-ДД)');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate.trim())) {
      Alert.alert('Ошибка', 'Формат даты: ГГГГ-ММ-ДД');
      return;
    }

    setExtending(true);
    try {
      const updated = await extendRental(rentalId, { newDate: newDate.trim() });
      setRental(updated);
      setShowExtend(false);
      setNewDate('');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось продлить аренду');
    } finally {
      setExtending(false);
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

  const isActive = rental.status === 'active';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.row}>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold', flex: 1 }}>
              {rental.itemName}
            </Text>
            <StatusBadge status={getEffectiveStatus()} domain="rental" />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Количество</Text>
            <Text variant="bodyMedium">{rental.quantity}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Цена/день</Text>
            <Text variant="bodyMedium">{Number(rental.pricePerDay).toFixed(2)} TJS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Выдал</Text>
            <Text variant="bodyMedium">{rental.issuedByName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Дата выдачи</Text>
            <Text variant="bodyMedium">
              {new Date(rental.issuedAt).toLocaleString('ru-RU')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Возврат до</Text>
            <Text
              variant="bodyMedium"
              style={isOverdue ? { color: '#EF4444', fontWeight: 'bold' } : undefined}
            >
              {new Date(rental.expectedReturn).toLocaleDateString('ru-RU')}
            </Text>
          </View>

          {rental.guestId && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Гость</Text>
              <Text variant="bodyMedium">{rental.guestId}</Text>
            </View>
          )}

          {rental.outletId && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Точка</Text>
              <Text variant="bodyMedium">{rental.outletId}</Text>
            </View>
          )}

          {rental.folioId && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Фолио</Text>
              <Text variant="bodyMedium">{rental.folioId}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Return info (for returned/damaged) */}
      {(rental.status === 'returned' || rental.status === 'damaged') && (
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Информация о возврате
            </Text>

            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Принял</Text>
              <Text variant="bodyMedium">{rental.returnedByName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Дата возврата</Text>
              <Text variant="bodyMedium">
                {rental.actualReturn
                  ? new Date(rental.actualReturn).toLocaleString('ru-RU')
                  : '—'}
              </Text>
            </View>

            {rental.damageNote && (
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.label}>Повреждение</Text>
                <Text variant="bodyMedium" style={{ flex: 1, textAlign: 'right' }}>
                  {rental.damageNote}
                </Text>
              </View>
            )}

            {rental.damageFee != null && Number(rental.damageFee) > 0 && (
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.label}>Штраф</Text>
                <Text variant="bodyMedium" style={{ color: '#EF4444' }}>
                  {Number(rental.damageFee).toFixed(2)} TJS
                </Text>
              </View>
            )}

            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text variant="titleMedium">Итого</Text>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {Number(rental.totalCharge).toFixed(2)} TJS
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Extend section */}
      {isActive && showExtend && (
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Продление аренды
            </Text>
            <TextInput
              label="Новая дата возврата (ГГГГ-ММ-ДД)"
              value={newDate}
              onChangeText={(v) => setNewDate(maskDate(v))}
              placeholder="2026-04-25"
              keyboardType="number-pad"
              maxLength={10}
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowExtend(false);
                  setNewDate('');
                }}
                style={styles.halfButton}
              >
                Отмена
              </Button>
              <Button
                mode="contained"
                onPress={handleExtend}
                loading={extending}
                disabled={extending || !newDate.trim()}
                style={styles.halfButton}
              >
                Продлить
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Action buttons */}
      {isActive && (
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() =>
              navigation.navigate('ReturnRental', { rentalId: rental.id })
            }
            style={styles.actionButton}
          >
            Оформить возврат
          </Button>
          {!showExtend && (
            <Button
              mode="outlined"
              onPress={() => setShowExtend(true)}
              style={styles.actionButton}
            >
              Продлить аренду
            </Button>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 12, paddingBottom: 40 },
  infoCard: { borderRadius: 12, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: { marginVertical: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { opacity: 0.6 },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfButton: { flex: 1 },
  actions: { gap: 8, marginTop: 4 },
  actionButton: { borderRadius: 8 },
});
