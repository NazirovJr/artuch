import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, TextInput as PaperTextInput } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createFolio } from '../../api/folios';
import { getGuests } from '../../api/guests';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormNumberInput, FormTextInput } from '../../components/form';
import { semanticSoft } from '../../theme/colors';
import {
  newFolioSchema,
  type NewFolioForm,
  type NewFolioInput,
} from '../../schemas/folio';

type Props = NativeStackScreenProps<RoomsStackParamList, 'FolioCreate'>;

export default function FolioCreateScreen({ navigation }: Props) {
  const [guests, setGuests] = useState<any[]>([]);
  // Local state — the search query isn't persisted with the form. Only
  // the resolved `guestId` (set when the user picks a result) goes into RHF.
  const [guestSearch, setGuestSearch] = useState('');

  const { control, handleSubmit, formState, watch, setValue } = useForm<
    NewFolioInput,
    any,
    NewFolioForm
  >({
    resolver: zodResolver(newFolioSchema),
    mode: 'onTouched',
    defaultValues: {
      guestId: undefined,
      roomNumber: undefined,
      notes: '',
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await getGuests();
        setGuests(data);
      } catch {
        // handle silently
      }
    })();
  }, []);

  const watchedGuestId = watch('guestId');
  const selectedGuest = guests.find((g) => g.id === watchedGuestId);

  const filteredGuests = guests.filter((g) => {
    if (!guestSearch.trim()) return true;
    const q = guestSearch.toLowerCase();
    const name = `${g.firstName || ''} ${g.lastName || ''}`.toLowerCase();
    return name.includes(q);
  });

  const onSubmit = async (data: NewFolioForm) => {
    try {
      const folio = await createFolio({
        guestId: data.guestId,
        roomNumber: data.roomNumber,
        notes: data.notes,
      });
      navigation.replace('FolioDetail', { folioId: folio.id });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать фолио');
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>
            Новое фолио
          </Text>

          {/* Guest search — pure local state, never validated by Zod.
              Picking a result writes into RHF's `guestId`. */}
          <Text variant="labelLarge" style={styles.sectionLabel}>
            Гость (необязательно)
          </Text>
          <PaperTextInput
            mode="outlined"
            label="Поиск гостя"
            placeholder="Начните вводить имя"
            value={guestSearch}
            onChangeText={(text) => {
              setGuestSearch(text);
              if (watchedGuestId) {
                setValue('guestId', undefined, { shouldValidate: true });
              }
            }}
            style={styles.searchInput}
          />

          {selectedGuest && (
            <Card style={styles.selectedCard}>
              <Card.Content>
                <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                  {selectedGuest.firstName} {selectedGuest.lastName}
                </Text>
                {selectedGuest.phone && (
                  <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                    {selectedGuest.phone}
                  </Text>
                )}
              </Card.Content>
            </Card>
          )}

          {!watchedGuestId && guestSearch.trim().length > 0 && (
            <View style={styles.guestList}>
              {filteredGuests.slice(0, 5).map((g) => (
                <Card
                  key={g.id}
                  style={styles.guestCard}
                  onPress={() => {
                    setValue('guestId', g.id, {
                      shouldValidate: true,
                      shouldTouch: true,
                    });
                    setGuestSearch(`${g.firstName} ${g.lastName}`);
                  }}
                >
                  <Card.Content style={styles.guestCardContent}>
                    <Text variant="bodyMedium">
                      {g.firstName} {g.lastName}
                    </Text>
                    {g.phone && (
                      <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                        {g.phone}
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}

          <FormNumberInput
            control={control}
            name="roomNumber"
            label="Номер комнаты"
            hint="Необязательно"
          />

          <FormTextInput
            control={control}
            name="notes"
            label="Заметки"
            multiline
            numberOfLines={3}
            hint="Необязательно"
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            disabled={formState.isSubmitting}
            style={styles.button}
          >
            Создать фолио
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
  sectionLabel: { marginBottom: 8, opacity: 0.7 },
  searchInput: { marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 8 },
  selectedCard: { marginBottom: 16, borderRadius: 8, backgroundColor: semanticSoft.success.bg },
  guestList: { marginBottom: 16 },
  guestCard: { marginBottom: 4, borderRadius: 8 },
  guestCardContent: { paddingVertical: 4 },
});
