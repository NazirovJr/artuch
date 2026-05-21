import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, useTheme } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShiftStore } from '../../store/shiftStore';
import { useToast } from '../../components/ui/Toast';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormNumberInput, FormTextInput } from '../../components/form';
import {
  shiftCloseSchema,
  type ShiftCloseForm,
  type ShiftCloseInput,
} from '../../schemas/shift';
import type { POSStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<POSStackParamList, 'ShiftClose'>;

/**
 * Blind close: cashier enters counted cash without seeing the expected total.
 * If variance exceeds threshold the backend requires a managerPin — we
 * surface that by toggling the conditional PIN field.
 */
export default function ShiftCloseScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { close, loading, active } = useShiftStore();
  const shiftId = route.params?.shiftId || active?.id;

  const [needPin, setNeedPin] = useState(false);
  const [result, setResult] = useState<{
    expectedCash: number;
    variance: number;
  } | null>(null);

  const { control, handleSubmit, formState, getValues } = useForm<
    ShiftCloseInput,
    any,
    ShiftCloseForm
  >({
    resolver: zodResolver(shiftCloseSchema),
    mode: 'onTouched',
    defaultValues: { actualCash: 0, notes: '', managerPin: '' },
  });

  if (!shiftId) {
    return (
      <ScreenContainer maxWidth="reading">
        <View style={styles.container}>
          <Card style={styles.card}>
            <Card.Content>
              <Text>Активная смена не найдена.</Text>
            </Card.Content>
          </Card>
        </View>
      </ScreenContainer>
    );
  }

  const onSubmit = async (data: ShiftCloseForm) => {
    try {
      const closed = await close(shiftId, {
        actualCash: data.actualCash,
        managerPin: data.managerPin,
        notes: data.notes,
      });
      setResult({
        expectedCash: Number(closed.expectedCash || 0),
        variance: Number(closed.variance || 0),
      });
      toast.show('Смена закрыта', 'success');
      setTimeout(() => navigation.popToTop(), 1500);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('manager pin')) {
        setNeedPin(true);
        toast.show('Расхождение крупное — требуется PIN менеджера', 'error');
      } else {
        toast.show(msg || 'Не удалось закрыть смену', 'error');
      }
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              Закрытие смены
            </Text>
            <Text variant="bodyMedium" style={styles.hint}>
              Пересчитай наличные в кассе и введи сумму. Сверка с ожидаемой суммой будет показана только после ввода (blind count).
            </Text>
            <FormNumberInput
              control={control}
              name="actualCash"
              label="Сосчитанные наличные"
              decimal
              suffix="TJS"
              disabled={!!result}
            />
            <FormTextInput
              control={control}
              name="notes"
              label="Комментарий (необязательно)"
              disabled={!!result}
            />
            {needPin && (
              <FormTextInput
                control={control}
                name="managerPin"
                label="PIN менеджера"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            )}
            {!result && (
              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                loading={loading}
                disabled={loading || !formState.isValid}
                style={styles.button}
              >
                Закрыть смену
              </Button>
            )}
            {result && (
              <View style={styles.summary}>
                <Text variant="bodyLarge">
                  Ожидалось:{' '}
                  <Text style={{ fontWeight: 'bold' }}>
                    {result.expectedCash.toFixed(2)} TJS
                  </Text>
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{
                    color:
                      result.variance === 0
                        ? theme.colors.primary
                        : theme.colors.error,
                    fontWeight: 'bold',
                  }}
                >
                  Расхождение: {result.variance.toFixed(2)} TJS
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  card: { borderRadius: 12 },
  title: { fontWeight: 'bold', marginBottom: 8 },
  hint: { marginBottom: 16 },
  button: { borderRadius: 8, marginTop: 4 },
  summary: { marginTop: 12, gap: 4 },
});
