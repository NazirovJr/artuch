import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { useToast } from '../../components/ui/Toast';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  FormSelect,
  FormNumberInput,
  FormDateInput,
  FormTextInput,
} from '../../components/form';
import {
  createIncome,
  getIncomeCategories,
  INCOME_PAYMENT_METHODS,
  type IncomeCategory,
} from '../../api/incomes';
import { getOutlets, type Outlet } from '../../api/outlets';
import {
  incomeFormSchema,
  type IncomeForm,
  type IncomeFormInput,
} from '../../schemas/income';

type Props = NativeStackScreenProps<AdminStackParamList, 'IncomeForm'>;

const fmtISO = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function IncomeFormScreen({ navigation }: Props) {
  const toast = useToast();
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const { control, handleSubmit, formState } = useForm<
    IncomeFormInput,
    any,
    IncomeForm
  >({
    resolver: zodResolver(incomeFormSchema),
    mode: 'onTouched',
    defaultValues: {
      categoryId: '',
      amount: undefined,
      paymentMethod: 'cash',
      receivedAt: new Date(),
      description: '',
      payer: '',
      outletId: '',
    },
  });

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [cats, outletsData] = await Promise.all([
        getIncomeCategories(),
        getOutlets(),
      ]);
      setCategories(cats);
      setOutlets(outletsData);
    } catch (e: any) {
      toast.error('Не удалось загрузить справочники', e?.message || 'Проверьте сеть');
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: IncomeForm) => {
    try {
      await createIncome({
        categoryId: data.categoryId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        receivedAt: fmtISO(data.receivedAt),
        description: data.description,
        payer: data.payer,
        outletId: data.outletId,
      });
      toast.success('Доход записан', money(data.amount));
      navigation.goBack();
    } catch (e: any) {
      toast.error('Не удалось записать доход', e?.message || 'Попробуйте ещё раз');
    }
  };

  if (loadingData) {
    return (
      <ScreenContainer maxWidth="reading">
        <View style={[styles.container, styles.center]}>
          <Text>Загрузка...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container}>
        <View style={styles.form}>
          <FormSelect
            control={control}
            name="categoryId"
            label="Категория *"
            placeholder="Выберите категорию"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <FormNumberInput
            control={control}
            name="amount"
            label="Сумма *"
            decimal
            suffix="TJS"
          />

          <FormSelect
            control={control}
            name="paymentMethod"
            label="Способ получения"
            variant="segmented"
            options={INCOME_PAYMENT_METHODS.map((m) => ({
              value: m.value,
              label: m.label,
              icon: m.icon,
            }))}
          />

          <FormDateInput
            control={control}
            name="receivedAt"
            label="Дата получения *"
            maxDate={new Date()}
          />

          <FormTextInput
            control={control}
            name="payer"
            label="Плательщик / источник"
            hint="Кто заплатил или откуда поступил доход"
          />

          <FormSelect
            control={control}
            name="outletId"
            label="Точка (центр учёта)"
            placeholder="Не указана"
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
          />

          <FormTextInput
            control={control}
            name="description"
            label="Примечание"
            multiline
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            disabled={formState.isSubmitting}
            style={styles.submitButton}
            icon="check"
          >
            Записать доход
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} TJS`;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  submitButton: { marginTop: 8, borderRadius: 8 },
});
