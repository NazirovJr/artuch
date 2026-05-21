import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  UnitConversion,
  deleteUnitConversion,
  getUnitConversions,
  upsertUnitConversion,
} from '../../api/lots';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  WarehouseStackParamList,
  'UnitConversions'
>;

export default function UnitConversionsScreen({ route }: Props) {
  const { source, itemId, itemName } = route.params;
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UnitConversion | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromUnit, setFromUnit] = useState('');
  const [factor, setFactor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUnitConversions(source, itemId);
      setConversions(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [source, itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDialog = (existing?: UnitConversion) => {
    setEditing(existing ?? null);
    setFromUnit(existing?.fromUnit ?? '');
    setFactor(existing ? String(existing.factor) : '');
    setNotes(existing?.notes ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const unit = fromUnit.trim();
    const f = Number(factor);
    if (!unit || !(f > 0)) return;
    setSaving(true);
    try {
      await upsertUnitConversion({
        source,
        itemId,
        fromUnit: unit,
        factor: f,
        notes: notes.trim() || undefined,
      });
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: UnitConversion) => {
    Alert.alert('Удалить конверсию?', `${item.fromUnit} → каноническая`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUnitConversion(item.id);
            await load();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: UnitConversion }) => (
    <Card mode="outlined" style={styles.card}>
      <Card.Title
        title={`1 ${item.fromUnit}`}
        subtitle={`= ${item.factor}`}
        right={(props) => (
          <View style={styles.row}>
            <IconButton
              {...props}
              icon="pencil"
              onPress={() => openDialog(item)}
            />
            <IconButton
              {...props}
              icon="delete"
              onPress={() => handleDelete(item)}
            />
          </View>
        )}
      />
      {item.notes && (
        <Card.Content>
          <Text variant="bodySmall">{item.notes}</Text>
        </Card.Content>
      )}
    </Card>
  );

  if (loading) {
    return <ScreenContainer maxWidth="reading" loading skeletonCount={3} />;
  }

  return (
    <ScreenContainer maxWidth="reading">
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>
          {itemName}
        </Text>
        <Text variant="bodySmall" style={styles.help}>
          Каждая строка — алиас единицы, который при операциях множится на
          factor для получения каноники.
        </Text>
      </View>
      <FlatList
        data={conversions}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="ruler"
            title="Нет конверсий"
            actionLabel="Добавить"
          />
        }
      />
      <View style={styles.footer}>
        <Button mode="contained" icon="plus" onPress={() => openDialog()}>
          Добавить
        </Button>
      </View>

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
          <Dialog.Title>
            {editing ? 'Редактировать' : 'Новая конверсия'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Из единицы"
              value={fromUnit}
              onChangeText={setFromUnit}
              placeholder="box, case, bottle…"
              autoCapitalize="none"
              disabled={!!editing}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Множитель (= в канонических)"
              keyboardType="decimal-pad"
              value={factor}
              onChangeText={setFactor}
              placeholder="6"
              style={styles.input}
            />
            <HelperText type="info" visible style={styles.helper}>
              Например: 1 box = 6 (бутылок), 1 case = 4500 (мл).
            </HelperText>
            <TextInput
              mode="outlined"
              label="Примечание"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onPress={handleSave}
              loading={saving}
              disabled={
                !fromUnit.trim() || !(Number(factor) > 0) || saving
              }
            >
              Сохранить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 6 },
  title: { fontWeight: '600' },
  help: { opacity: 0.7 },
  list: { paddingHorizontal: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row' },
  footer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  input: { marginBottom: 12 },
  helper: { paddingHorizontal: 0 },
});
