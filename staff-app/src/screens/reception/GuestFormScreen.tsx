import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createGuest } from '../../api/guests';
import { useRoomStore } from '../../store/roomStore';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormTextInput } from '../../components/form';
import { guestSchema, type GuestForm } from '../../schemas/guest';
import { maskPhone } from '../../utils/inputMask';
import type { z } from 'zod';

type GuestFormInput = z.input<typeof guestSchema>;

interface Props {
  onBack: () => void;
  onDone: () => void;
}

export default function GuestFormScreen({ onBack, onDone }: Props) {
  const { setGuests, guests } = useRoomStore();
  const [submitting, setSubmitting] = useState(false);

  // Two type params because the schema uses `preprocess` (input is `unknown`,
  // output is the typed shape). RHF v7 needs both to type-check correctly.
  const { control, handleSubmit, formState } = useForm<GuestFormInput, any, GuestForm>({
    resolver: zodResolver(guestSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      passportNumber: '',
      phone: '',
      email: '',
      nationality: '',
    },
  });

  const onSubmit = async (data: GuestForm) => {
    setSubmitting(true);
    try {
      const newGuest = await createGuest(data);
      setGuests([newGuest, ...guests]);
      Alert.alert('Успешно', 'Гость добавлен', [{ text: 'OK', onPress: onDone }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать гостя');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Button icon="arrow-left" onPress={onBack} style={styles.backButton}>
          Назад
        </Button>

        <Text variant="headlineMedium" style={styles.title}>
          Новый гость
        </Text>

        <FormTextInput control={control} name="firstName" label="Имя *" />
        <FormTextInput control={control} name="lastName" label="Фамилия *" />
        <FormTextInput control={control} name="passportNumber" label="Номер паспорта" />
        <FormTextInput
          control={control}
          name="phone"
          label="Телефон"
          keyboardType="phone-pad"
          mask={maskPhone}
        />
        <FormTextInput
          control={control}
          name="email"
          label="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormTextInput control={control} name="nationality" label="Гражданство" />

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          disabled={submitting || !formState.isValid}
          style={styles.saveButton}
          icon="check"
        >
          Сохранить
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  backButton: { alignSelf: 'flex-start', marginBottom: 8 },
  title: { fontWeight: 'bold', marginBottom: 16 },
  saveButton: { marginTop: 16 },
});
