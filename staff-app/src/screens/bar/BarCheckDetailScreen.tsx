import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { getCheck, type TableCheck } from '../../api/checks';
import type { BarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarStackParamList, 'BarCheckDetail'>;

export default function BarCheckDetailScreen({ route, navigation }: Props) {
  const { checkId } = route.params;
  const theme = useTheme();
  const [check, setCheck] = useState<TableCheck | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const c = await getCheck(checkId);
      setCheck(c);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [checkId]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={{ marginTop: 32 }} />
      </ScreenContainer>
    );
  }

  if (!check) return null;

  const allItems = (check.orders || [])
    .flatMap((o) => o.items || [])
    .filter((i) => i.status !== 'cancelled');

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Счёт #{check.checkNumber} · {check.tableNumber}</Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.primary, marginTop: 4 }}>
              {Number(check.total).toFixed(2)} TJS
            </Text>
          </Card.Content>
        </Card>

        {/* Items */}
        {allItems.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={{ marginBottom: 8, opacity: 0.7 }}>Позиции</Text>
              {allItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{item.menuItemName}</Text>
                    <Chip compact style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                      {item.status}
                    </Chip>
                  </View>
                  <Text variant="bodyMedium">
                    ×{item.quantity} · {(Number(item.menuItemPrice) * item.quantity).toFixed(2)} TJS
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Text variant="titleSmall" style={{ marginBottom: 8, opacity: 0.7 }}>Добавить позиции</Text>
          <Button
            mode="outlined"
            icon="food"
            style={styles.btn}
            onPress={() =>
              navigation.navigate('BarAddRound', {
                checkId: check.id,
                tableNumber: check.tableNumber,
              })
            }
          >
            Из меню (через KDS)
          </Button>
          <Button
            mode="outlined"
            icon="bottle-wine"
            style={styles.btn}
            onPress={() => navigation.navigate('BarQuickAdd', { checkId: check.id })}
          >
            Из бара напрямую
          </Button>
        </View>

        <Divider style={{ marginVertical: 12 }} />

        <Button
          mode="contained"
          icon="cash"
          style={styles.payBtn}
          onPress={() => navigation.navigate('BarSettlement', { checkId: check.id })}
          disabled={allItems.length === 0}
        >
          Оплатить {Number(check.total).toFixed(2)} TJS
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 12, paddingBottom: 32 },
  card: { borderRadius: 12, marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  actions: { marginBottom: 8 },
  btn: { marginBottom: 8, borderRadius: 8 },
  payBtn: { borderRadius: 8, paddingVertical: 4 },
});
