import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  StockTransfer,
  cancelTransfer,
  getTransfer,
  receiveTransfer,
} from '../../api/transfers';
import { useAuthStore } from '../../store/authStore';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  WarehouseStackParamList,
  'ReceiveTransfer'
>;

export default function ReceiveTransferScreen({ route, navigation }: Props) {
  const { transferId } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [received, setReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const t = await getTransfer(transferId);
      setTransfer(t);
      setReceived(String(t.quantity));
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [transferId, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !transfer) {
    return <ScreenContainer maxWidth="reading" loading skeletonCount={3} />;
  }

  const sentQty = Number(transfer.quantity);
  const receivedQty = Number(received);
  const isReceivedValid =
    !Number.isNaN(receivedQty) && receivedQty >= 0 && receivedQty <= sentQty;
  const variance = isReceivedValid ? sentQty - receivedQty : 0;

  const isInTransit = transfer.status === 'in_transit';

  const handleReceive = async () => {
    if (!user || !isReceivedValid) return;
    setSaving(true);
    try {
      await receiveTransfer(transfer.id, {
        receivedBy: user.id,
        receivedQuantity: receivedQty,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось принять');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
    Alert.alert(
      'Отменить перемещение?',
      'Товар будет возвращён на склад-источник.',
      [
        { text: 'Назад', style: 'cancel' },
        {
          text: 'Отменить',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await cancelTransfer(transfer.id, {
                cancelledBy: user.id,
                notes: notes.trim() || undefined,
              });
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось отменить');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <Card mode="outlined" style={styles.card}>
          <Card.Title
            title={transfer.sourceItem?.name ?? '—'}
            subtitle={`${transfer.sourceWarehouse?.name} → ${transfer.targetWarehouse?.name}`}
          />
          <Card.Content>
            <Text variant="bodyLarge">
              Отправлено: {sentQty} {transfer.sourceItem?.unit}
            </Text>
            <Text variant="labelSmall" style={styles.meta}>
              {new Date(transfer.createdAt).toLocaleString('ru-RU')}
            </Text>
            {transfer.notes && (
              <Text style={styles.notes}>{transfer.notes}</Text>
            )}
          </Card.Content>
        </Card>

        {!isInTransit ? (
          <Text variant="titleMedium" style={styles.label}>
            Уже {transfer.status === 'received' ? 'принято' : 'отменено'}
          </Text>
        ) : (
          <>
            <Text variant="titleMedium" style={styles.label}>
              Сколько фактически принято
            </Text>
            <TextInput
              mode="outlined"
              keyboardType="decimal-pad"
              value={received}
              onChangeText={setReceived}
              error={!isReceivedValid}
              right={
                <TextInput.Affix text={transfer.sourceItem?.unit ?? ''} />
              }
            />
            {!isReceivedValid && (
              <HelperText type="error" visible>
                Должно быть от 0 до {sentQty}
              </HelperText>
            )}
            {variance > 0 && (
              <HelperText type="info" visible>
                Недостача: {variance.toFixed(2)} — будет списано как
                in-transit loss
              </HelperText>
            )}

            <Text variant="titleMedium" style={styles.label}>Примечание</Text>
            <TextInput
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                disabled={saving}
                style={styles.flex}
                textColor={theme.colors.error}
              >
                Отменить
              </Button>
              <Button
                mode="contained"
                onPress={handleReceive}
                loading={saving}
                disabled={saving || !isReceivedValid}
                style={styles.flex}
              >
                Принять
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 64 },
  card: { marginBottom: 16 },
  meta: { marginTop: 4, opacity: 0.6 },
  notes: { marginTop: 8, fontStyle: 'italic' },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  flex: { flex: 1 },
});
