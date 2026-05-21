import React from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRental } from '../../api/rentals';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WarehouseStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  FormDateInput,
  FormNumberInput,
  FormTextInput,
} from '../../components/form';
import {
  newRentalSchema,
  type NewRentalForm,
  type NewRentalInput,
} from '../../schemas/rental';

type Props = NativeStackScreenProps<WarehouseStackParamList, 'NewRental'>;

const formatISO = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function NewRentalScreen({ navigation }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { control, handleSubmit, formState } = useForm<
    NewRentalInput,
    any,
    NewRentalForm
  >({
    resolver: zodResolver(newRentalSchema),
    mode: 'onTouched',
    defaultValues: {
      itemId: '',
      itemName: '',
      guestId: '',
      outletId: '',
      quantity: 1,
      pricePerDay: 0,
      expectedReturn: undefined,
    },
  });

  const onSubmit = async (data: NewRentalForm) => {
    try {
      await createRental({
        itemId: data.itemId,
        itemName: data.itemName,
        guestId: data.guestId,
        outletId: data.outletId,
        quantity: data.quantity,
        pricePerDay: data.pricePerDay,
        expectedReturn: formatISO(data.expectedReturn),
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать аренду');
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <FormTextInput control={control} name="itemId" label="ID предмета" />
        <FormTextInput control={control} name="itemName" label="Название предмета *" />
        <FormTextInput control={control} name="guestId" label="ID гостя" />
        <FormTextInput control={control} name="outletId" label="ID точки" />
        <FormNumberInput control={control} name="quantity" label="Количество" />
        <FormNumberInput
          control={control}
          name="pricePerDay"
          label="Цена за день *"
          decimal
          suffix="TJS"
        />
        <FormDateInput
          control={control}
          name="expectedReturn"
          label="Дата возврата *"
          minDate={today}
        />

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={formState.isSubmitting}
          disabled={formState.isSubmitting || !formState.isValid}
          style={styles.submitButton}
        >
          Создать аренду
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  submitButton: { marginTop: 8, borderRadius: 8 },
});
