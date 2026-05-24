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
  createExpense,
  getExpenseCategories,
  EXPENSE_PAYMENT_METHODS,
  type ExpenseCategory,
} from '../../api/expenses';
import { getOutlets, type Outlet } from '../../api/outlets';
import { getSuppliers, type Supplier } from '../../api/suppliers';
import {
  expenseFormSchema,
  type ExpenseForm,
  type ExpenseFormInput,
} from '../../schemas/expense';

type Props = NativeStackScreenProps<AdminStackParamList, 'ExpenseForm'>;

const fmtISO = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function ExpenseFormScreen({ navigation }: Props) {
  const toast = useToast();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const { control, handleSubmit, formState } = useForm<
    ExpenseFormInput,
    any,
    ExpenseForm
  >({
    resolver: zodResolver(expenseFormSchema),
    mode: 'onTouched',
    defaultValues: {
      categoryId: '',
      amount: undefined,
      paymentMethod: 'cash',
      spentAt: new Date(),
      description: '',
      vendor: '',
      supplierId: '',
      outletId: '',
    },
  });

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [cats, outletsData, suppliersData] = await Promise.all([
        getExpenseCategories(),
        getOutlets(),
        getSuppliers(),
      ]);
      setCategories(cats);
      setOutlets(outletsData);
      setSuppliers(suppliersData);
    } catch (e: any) {
      toast.error('Не удалось загрузить справочники', e?.message || 'Проверьте сеть');
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: ExpenseForm) => {
    try {
      await createExpense({
        categoryId: data.categoryId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        spentAt: fmtISO(data.spentAt),
        description: data.description,
        vendor: data.vendor,
        supplierId: data.supplierId,
        outletId: data.outletId,
      });
      toast.success('Затрата записана', money(data.amount));
      navigation.goBack();
    } catch (e: any) {
      toast.error('Не удалось записать затрату', e?.message || 'Попробуйте ещё раз');
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
            label="Способ оплаты"
            variant="segmented"
            options={EXPENSE_PAYMENT_METHODS.map((m) => ({
              value: m.value,
              label: m.label,
              icon: m.icon,
            }))}
          />

          <FormDateInput
            control={control}
            name="spentAt"
            label="Дата траты *"
            maxDate={new Date()}
          />

          <FormSelect
            control={control}
            name="supplierId"
            label="Поставщик"
            placeholder="Не указан"
            hint="Опционально — если затрата привязана к поставщику"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />

          <FormTextInput
            control={control}
            name="vendor"
            label="Получатель / контрагент"
            hint="Свободный текст, если поставщика нет в списке"
          />

          <FormSelect
            control={control}
            name="outletId"
            label="Точка (центр затрат)"
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
            Записать затрату
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
