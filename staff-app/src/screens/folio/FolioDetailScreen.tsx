import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, Divider, useTheme } from 'react-native-paper';
import { getFolio, closeFolio } from '../../api/folios';
import StatusBadge from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { semantic } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RoomsStackParamList, 'FolioDetail'> & {
  /** Master-detail mode: bypasses route.params (component is rendered without a real route). */
  folioIdOverride?: string;
};

const CHARGE_TYPE_LABELS: Record<string, string> = {
  room: 'Номер',
  restaurant: 'Ресторан',
  bar: 'Бар',
  shop: 'Магазин',
  rental: 'Прокат',
  service: 'Услуга',
  discount: 'Скидка',
  refund: 'Возврат',
  payment: 'Оплата',
  deposit: 'Депозит',
};

export default function FolioDetailScreen({ route, navigation, folioIdOverride }: Props) {
  // Supports both route-driven (phone push) and prop-driven (tablet split) modes.
  const folioId = folioIdOverride ?? route?.params?.folioId;
  const theme = useTheme();
  const toast = useToast();
  const [folio, setFolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchFolio = useCallback(async () => {
    if (!folioId) {
      setFolio(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getFolio(folioId);
      setFolio(data);
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить фолио');
    } finally {
      setLoading(false);
    }
  }, [folioId, toast]);

  useEffect(() => {
    fetchFolio();
  }, [fetchFolio]);

  useEffect(() => {
    // `navigation.addListener` only exists when mounted as a Stack.Screen.
    // In SplitView mode the wrapper passes the same `navigation` prop, so
    // this still works — but if a future caller renders us without one,
    // skip the listener instead of crashing.
    if (!navigation?.addListener) return;
    const unsubscribe = navigation.addListener('focus', () => {
      fetchFolio();
    });
    return unsubscribe;
  }, [navigation, fetchFolio]);

  const handleClose = () => {
    const balance = Number(folio.totalAmount || 0) - Number(folio.paidAmount || 0);
    if (balance > 0) {
      navigation.navigate('FolioClose', { folioId });
      return;
    }

    Alert.alert('Закрытие фолио', 'Вы уверены, что хотите закрыть фолио?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Закрыть',
        onPress: async () => {
          setClosing(true);
          try {
            await closeFolio(folioId);
            // Jump straight to the printed receipt so reception can show
            // it to the guest at checkout. `replace` avoids keeping a
            // stale "open folio" frame in the back-stack.
            navigation.replace('FolioReceipt', { folioId });
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось закрыть фолио');
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  if (!folio) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Фолио не найдено</Text>
      </View>
    );
  }

  const totalAmount = Number(folio.totalAmount || 0);
  const paidAmount = Number(folio.paidAmount || 0);
  const balance = totalAmount - paidAmount;
  const charges = folio.charges || [];
  const isOpen = folio.status === 'open';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
              Фолио #{folio.id?.slice(0, 8)}
            </Text>
            <StatusBadge status={folio.status} domain="folio" />
          </View>
        </Card.Content>
      </Card>

      {/* Info card */}
      <Card style={styles.card}>
        <Card.Title title="Информация" />
        <Card.Content>
          {folio.roomNumber != null && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Номер</Text>
              <Text variant="bodyMedium">#{folio.roomNumber}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.label}>Открыт</Text>
            <Text variant="bodyMedium">
              {folio.openedAt ? new Date(folio.openedAt).toLocaleString('ru-RU') : '-'}
            </Text>
          </View>
          {folio.closedAt && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Закрыт</Text>
              <Text variant="bodyMedium">
                {new Date(folio.closedAt).toLocaleString('ru-RU')}
              </Text>
            </View>
          )}
          {folio.notes && (
            <>
              <Divider style={styles.divider} />
              <Text variant="labelSmall" style={styles.label}>Заметки</Text>
              <Text variant="bodyMedium">{folio.notes}</Text>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Balance summary */}
      <Card style={styles.card}>
        <Card.Title title="Баланс" />
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
            <Text variant="titleMedium">К оплате</Text>
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', color: balance > 0 ? semantic.error : semantic.success }}
            >
              {balance.toFixed(2)} TJS
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Charges list */}
      <Card style={styles.card}>
        <Card.Title title={`Начисления (${charges.length})`} />
        <Card.Content>
          {charges.length === 0 ? (
            <Text variant="bodyMedium" style={{ opacity: 0.5 }}>
              Нет начислений
            </Text>
          ) : (
            charges
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((charge: any) => {
                const amt = Number(charge.amount);
                const isPositive = amt > 0;
                return (
                  <View key={charge.id}>
                    <View style={styles.chargeRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                          {charge.description}
                        </Text>
                        <Text variant="bodySmall" style={styles.label}>
                          {CHARGE_TYPE_LABELS[charge.chargeType] || charge.chargeType}
                          {' \u00b7 '}
                          {charge.createdAt ? new Date(charge.createdAt).toLocaleString('ru-RU') : ''}
                        </Text>
                      </View>
                      <Text
                        variant="bodyMedium"
                        style={{
                          fontWeight: 'bold',
                          color: isPositive ? semantic.success : semantic.error,
                        }}
                      >
                        {isPositive ? '+' : ''}{amt.toFixed(2)}
                      </Text>
                    </View>
                    <Divider style={{ marginVertical: 4 }} />
                  </View>
                );
              })
          )}
        </Card.Content>
      </Card>

      {/* Action buttons */}
      {isOpen && (
        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            icon="plus"
            onPress={() => navigation.navigate('AddCharge', { folioId, mode: 'charge' })}
            style={styles.actionButton}
          >
            Начислить
          </Button>

          <Button
            mode="contained"
            icon="cash"
            onPress={() => navigation.navigate('AddCharge', { folioId, mode: 'payment' })}
            style={[styles.actionButton, { backgroundColor: semantic.success }]}
          >
            Оплатить
          </Button>

          <Button
            mode="outlined"
            icon="bank-transfer-in"
            onPress={() => navigation.navigate('AddCharge', { folioId, mode: 'deposit' })}
            style={styles.actionButton}
          >
            Принять депозит
          </Button>

          <Button
            mode="outlined"
            icon="percent"
            onPress={() => navigation.navigate('AddCharge', { folioId, mode: 'discount' })}
            style={styles.actionButton}
          >
            Скидка
          </Button>

          <Button
            mode="outlined"
            icon="file-document-outline"
            onPress={() => navigation.navigate('FolioReceipt', { folioId })}
            style={styles.actionButton}
          >
            Накладная / Чек
          </Button>

          <Button
            mode="outlined"
            icon="lock"
            onPress={handleClose}
            loading={closing}
            disabled={closing}
            style={styles.actionButton}
            textColor={semantic.error}
          >
            Закрыть фолио
          </Button>
        </View>
      )}

      {/* Closed folios: receipt + invoice */}
      {!isOpen && (
        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            icon="file-document-outline"
            onPress={() => navigation.navigate('FolioReceipt', { folioId })}
            style={styles.actionButton}
          >
            Накладная / Чек
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { margin: 12, marginBottom: 0, borderRadius: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { opacity: 0.6 },
  divider: { marginVertical: 8 },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionsContainer: {
    padding: 12,
    gap: 8,
    paddingBottom: 32,
  },
  actionButton: {
    borderRadius: 8,
  },
});
