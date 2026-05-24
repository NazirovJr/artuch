import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CleaningStackParamList } from '../../navigation/types';
import { useToast } from '../../components/ui/Toast';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormSelect } from '../../components/form';
import { createCleaningTask } from '../../api/cleaning';
import { getRooms } from '../../api/rooms';
import { getUsers } from '../../api/users';
import {
  cleaningRequestSchema,
  type CleaningRequestForm,
  type CleaningRequestFormInput,
} from '../../schemas/cleaning';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningRequest'>;

const TYPE_OPTIONS = [
  { value: 'departure', label: 'После выезда' },
  { value: 'stayover', label: 'Текущая' },
  { value: 'deep', label: 'Генеральная' },
  { value: 'inspection', label: 'Инспекция' },
];

const CLEANING_STATUS_LABEL: Record<string, string> = {
  'needs-cleaning': 'требует уборки',
  clean: 'чисто',
  'in-progress': 'убирается',
};

export default function CleaningRequestFormScreen({ navigation }: Props) {
  const toast = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const { control, handleSubmit, formState } = useForm<
    CleaningRequestFormInput,
    any,
    CleaningRequestForm
  >({
    resolver: zodResolver(cleaningRequestSchema),
    mode: 'onTouched',
    defaultValues: {
      roomNumber: '',
      type: 'departure',
      assignedTo: '',
    },
  });

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [roomsData, usersData] = await Promise.all([getRooms(), getUsers()]);
      setRooms(
        [...roomsData].sort((a, b) => Number(a.number) - Number(b.number)),
      );
      setCleaners(
        usersData.filter((u) => u.role === 'cleaning' && u.isActive !== false),
      );
    } catch (e: any) {
      toast.error('Не удалось загрузить справочники', e?.message || 'Проверьте сеть');
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: CleaningRequestForm) => {
    try {
      await createCleaningTask({
        roomNumber: Number(data.roomNumber),
        type: data.type,
        assignedTo: data.assignedTo,
      });
      toast.success('Заявка создана', `Номер ${data.roomNumber}`);
      navigation.goBack();
    } catch (e: any) {
      toast.error('Не удалось создать заявку', e?.message || 'Попробуйте ещё раз');
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
            name="roomNumber"
            label="Номер *"
            placeholder="Выберите номер"
            options={rooms.map((r) => ({
              value: String(r.number),
              label: `Номер ${r.number}${
                r.cleaningStatus
                  ? ` · ${CLEANING_STATUS_LABEL[r.cleaningStatus] || r.cleaningStatus}`
                  : ''
              }`,
            }))}
          />

          <FormSelect
            control={control}
            name="type"
            label="Тип уборки *"
            options={TYPE_OPTIONS}
          />

          <FormSelect
            control={control}
            name="assignedTo"
            label="Исполнитель"
            placeholder="Не назначен"
            hint="Опционально — иначе заявка попадёт в «Свободные»"
            options={cleaners.map((c) => ({ value: c.id, label: c.fullName }))}
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            disabled={formState.isSubmitting}
            style={styles.submitButton}
            icon="check"
          >
            Создать заявку
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  submitButton: { marginTop: 8, borderRadius: 8 },
});
