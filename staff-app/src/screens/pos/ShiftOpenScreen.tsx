import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, useTheme } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShiftStore } from '../../store/shiftStore';
import { usePosStore } from '../../store/posStore';
import { useToast } from '../../components/ui/Toast';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormNumberInput } from '../../components/form';
import { shiftOpenSchema, type ShiftOpenForm, type ShiftOpenInput } from '../../schemas/shift';
import type { POSStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<POSStackParamList, 'ShiftOpen'>;

export default function ShiftOpenScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { open, loading } = useShiftStore();
  const currentOutlet = usePosStore((s) => s.currentOutlet);

  const { control, handleSubmit, formState } = useForm<ShiftOpenInput, any, ShiftOpenForm>({
    resolver: zodResolver(shiftOpenSchema),
    mode: 'onTouched',
    defaultValues: { openingCash: 0 },
  });

  const onSubmit = async (data: ShiftOpenForm) => {
    try {
      await open({ openingCash: data.openingCash, outletId: currentOutlet?.id });
      toast.show('Смена открыта', 'success');
      navigation.goBack();
    } catch (e: any) {
      toast.show(e?.message || 'Не удалось открыть смену', 'error');
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              Открыть смену
            </Text>
            <Text variant="bodyMedium" style={styles.hint}>
              Пересчитай наличные в кассе и введи сумму. Это исходный остаток для сверки в конце смены.
            </Text>
            <FormNumberInput
              control={control}
              name="openingCash"
              label="Наличные в кассе"
              decimal
              suffix="TJS"
            />
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
              Точка: {currentOutlet?.name || 'не выбрана'}
            </Text>
            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              disabled={loading || !formState.isValid}
              style={styles.button}
            >
              Открыть смену
            </Button>
          </Card.Content>
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { borderRadius: 12 },
  title: { fontWeight: 'bold', marginBottom: 8 },
  hint: { marginBottom: 16 },
  button: { borderRadius: 8 },
});
