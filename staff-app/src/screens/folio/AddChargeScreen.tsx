import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  addCharge,
  addPayment,
  addDiscount,
  addDeposit,
} from '../../api/folios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormNumberInput, FormSelect, FormTextInput } from '../../components/form';
import {
  addChargeSchema,
  type AddChargeForm,
  type AddChargeInput,
  type FolioMode,
} from '../../schemas/folio';

type Props = NativeStackScreenProps<RoomsStackParamList, 'AddCharge'>;

const CHARGE_TYPES = [
  { value: 'room', label: 'Номер' },
  { value: 'restaurant', label: 'Ресторан' },
  { value: 'bar', label: 'Бар' },
  { value: 'shop', label: 'Магазин' },
  { value: 'rental', label: 'Прокат' },
  { value: 'service', label: 'Услуга' },
] as const;

const TITLES: Record<FolioMode, string> = {
  charge: 'Начисление',
  payment: 'Оплата',
  discount: 'Скидка',
  deposit: 'Депозит',
};

const SUBMIT_LABELS: Record<FolioMode, string> = {
  charge: 'Начислить',
  payment: 'Оплатить',
  discount: 'Применить скидку',
  deposit: 'Принять депозит',
};

export default function AddChargeScreen({ route, navigation }: Props) {
  const { folioId, mode } = route.params;
  const theme = useTheme();

  const { control, handleSubmit, formState } = useForm<AddChargeInput, any, AddChargeForm>({
    resolver: zodResolver(addChargeSchema),
    mode: 'onTouched',
    defaultValues: {
      mode,
      chargeType: mode === 'charge' ? 'service' : undefined,
      description: '',
      amount: 0,
    },
  });

  const onSubmit = async (data: AddChargeForm) => {
    try {
      if (data.mode === 'charge') {
        await addCharge(folioId, {
          chargeType: data.chargeType!,
          description: data.description!,
          amount: data.amount,
        });
      } else if (data.mode === 'payment') {
        await addPayment(folioId, { amount: data.amount, description: data.description });
      } else if (data.mode === 'deposit') {
        await addDeposit(folioId, {
          amount: data.amount,
          description: data.description ?? 'Депозит',
        });
      } else {
        await addDiscount(folioId, {
          amount: data.amount,
          description: data.description ?? 'Скидка',
        });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось добавить');
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>
            {TITLES[mode]}
          </Text>

          {mode === 'charge' && (
            <FormSelect
              control={control}
              name="chargeType"
              label="Тип начисления"
              options={CHARGE_TYPES}
              variant="segmented"
            />
          )}

          <FormTextInput
            control={control}
            name="description"
            label="Описание"
            placeholder={
              mode === 'payment'
                ? 'Оплата наличными'
                : mode === 'discount'
                ? 'Скидка постоянного гостя'
                : mode === 'deposit'
                ? 'Предоплата за номер'
                : 'Описание начисления'
            }
          />

          <FormNumberInput
            control={control}
            name="amount"
            label="Сумма"
            decimal
            suffix="TJS"
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            disabled={formState.isSubmitting || !formState.isValid}
            style={styles.button}
          >
            {SUBMIT_LABELS[mode]}
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontWeight: 'bold', marginBottom: 16 },
  button: { marginTop: 8, borderRadius: 8 },
});
