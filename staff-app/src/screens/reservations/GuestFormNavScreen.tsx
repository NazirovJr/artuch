import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { createGuest } from '../../api/guests';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import { maskPhone } from '../../utils/inputMask';

type Props = NativeStackScreenProps<RoomsStackParamList, 'GuestForm'>;

export default function GuestFormNavScreen({ navigation }: Props) {
  const theme = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Ошибка', 'Имя и фамилия обязательны');
      return;
    }

    setLoading(true);
    try {
      await createGuest({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        passportNumber: passportNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        nationality: nationality.trim() || undefined,
      });
      Alert.alert('Успешно', 'Гость добавлен', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать гостя');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.form}>
        <TextInput
          label="Имя *"
          value={firstName}
          onChangeText={setFirstName}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Фамилия *"
          value={lastName}
          onChangeText={setLastName}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Номер паспорта"
          value={passportNumber}
          onChangeText={setPassportNumber}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Телефон"
          value={phone}
          onChangeText={(v) => setPhone(maskPhone(v))}
          mode="outlined"
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          label="Гражданство"
          value={nationality}
          onChangeText={setNationality}
          mode="outlined"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading || !firstName.trim() || !lastName.trim()}
          style={styles.saveButton}
          icon="check"
        >
          Сохранить
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16 },
  input: { marginBottom: 12 },
  saveButton: { marginTop: 8 },
});
