import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Switch, Text } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { useToast } from '../../components/ui/Toast';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormSelect, FormTextInput } from '../../components/form';
import { semantic } from '../../theme/colors';
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  EXPENSE_GROUPS,
  type ExpenseCategory,
} from '../../api/expenses';
import {
  expenseCategoryFormSchema,
  type ExpenseCategoryForm,
  type ExpenseCategoryFormInput,
} from '../../schemas/expense';

type Props = NativeStackScreenProps<AdminStackParamList, 'ExpenseCategoryForm'>;

export default function ExpenseCategoryFormScreen({ route, navigation }: Props) {
  const toast = useToast();
  const categoryId = route.params?.categoryId;
  const isEditing = !!categoryId;
  const [loadingData, setLoadingData] = useState(isEditing);
  const [isSystem, setIsSystem] = useState(false);

  const { control, handleSubmit, formState, reset } = useForm<
    ExpenseCategoryFormInput,
    any,
    ExpenseCategoryForm
  >({
    resolver: zodResolver(expenseCategoryFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      group: 'other',
      description: '',
      isActive: true,
    },
  });

  const fetchData = useCallback(async () => {
    if (!categoryId) return;
    setLoadingData(true);
    try {
      const all = await getExpenseCategories(true);
      const cat = all.find((c) => c.id === categoryId);
      if (cat) {
        setIsSystem(cat.isSystem);
        reset({
          name: cat.name,
          group: cat.group as ExpenseCategoryForm['group'],
          description: cat.description || '',
          isActive: cat.isActive,
        });
      }
    } catch (e: any) {
      toast.error('Не удалось загрузить категорию', e?.message || 'Проверьте сеть');
    } finally {
      setLoadingData(false);
    }
  }, [categoryId, reset, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: ExpenseCategoryForm) => {
    try {
      if (isEditing && categoryId) {
        await updateExpenseCategory(categoryId, data);
        toast.success('Сохранено', data.name);
      } else {
        await createExpenseCategory(data);
        toast.success('Категория создана', data.name);
      }
      navigation.goBack();
    } catch (e: any) {
      toast.error(
        isEditing ? 'Не удалось сохранить' : 'Не удалось создать',
        e?.message || 'Попробуйте ещё раз',
      );
    }
  };

  const confirmDelete = () => {
    if (!categoryId) return;
    Alert.alert('Удалить категорию?', 'Категория будет скрыта из списка.', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpenseCategory(categoryId);
            toast.success('Категория удалена');
            navigation.goBack();
          } catch (e: any) {
            toast.error('Не удалось удалить', e?.message || 'Попробуйте ещё раз');
          }
        },
      },
    ]);
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
          <FormTextInput control={control} name="name" label="Название *" />

          <FormSelect
            control={control}
            name="group"
            label="Группа (для P&L) *"
            options={EXPENSE_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
          />

          <FormTextInput
            control={control}
            name="description"
            label="Описание"
            multiline
          />

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <View style={styles.switchRow}>
                <Text variant="bodyLarge">Активна</Text>
                <Switch value={!!field.value} onValueChange={field.onChange} />
              </View>
            )}
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            disabled={formState.isSubmitting}
            style={styles.submitButton}
            icon="check"
          >
            {isEditing ? 'Сохранить' : 'Создать'}
          </Button>

          {isEditing && !isSystem && (
            <Button
              mode="outlined"
              onPress={confirmDelete}
              style={styles.deleteButton}
              textColor={semantic.error}
              icon="trash-can-outline"
            >
              Удалить категорию
            </Button>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  submitButton: { marginTop: 8, borderRadius: 8 },
  deleteButton: { marginTop: 12, borderRadius: 8, borderColor: semantic.error },
});
