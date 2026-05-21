import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  Stocktake,
  StocktakeLine,
  VarianceReason,
  approveStocktake,
  cancelStocktake,
  getStocktake,
  recordCount,
  submitStocktake,
} from '../../api/stocktakes';
import { useAuthStore } from '../../store/authStore';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  WarehouseStackParamList,
  'StocktakeDetail'
>;

const REASON_LABEL: Record<VarianceReason, string> = {
  spoilage: 'Просрочка',
  theft: 'Кража',
  count_error: 'Ошибка учёта',
  damage: 'Порча',
  other: 'Другое',
};

export default function StocktakeDetailScreen({ route, navigation }: Props) {
  const { stocktakeId } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const [stocktake, setStocktake] = useState<Stocktake | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLine, setEditingLine] = useState<StocktakeLine | null>(null);
  const [actualText, setActualText] = useState('');
  const [reason, setReason] = useState<VarianceReason | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const t = await getStocktake(stocktakeId);
      setStocktake(t);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [stocktakeId, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const lines = stocktake?.lines ?? [];
    const counted = lines.filter(
      (l) => l.actual !== null && l.actual !== undefined,
    ).length;
    const variance = lines.filter(
      (l) => l.variance !== null && Number(l.variance) !== 0,
    ).length;
    return { total: lines.length, counted, variance };
  }, [stocktake]);

  const openEdit = (line: StocktakeLine) => {
    setEditingLine(line);
    setActualText(line.actual != null ? String(line.actual) : '');
    setReason((line.varianceReason as VarianceReason) ?? '');
    setNote(line.note ?? '');
  };

  const handleSaveCount = async () => {
    if (!editingLine || !stocktake || actualText === '') return;
    const actual = Number(actualText);
    if (Number.isNaN(actual) || actual < 0) return;
    setSaving(true);
    try {
      const variance = actual - Number(editingLine.expected);
      await recordCount(stocktake.id, editingLine.id, {
        actual,
        varianceReason:
          variance !== 0 && reason ? (reason as VarianceReason) : undefined,
        note: note.trim() || undefined,
      });
      setEditingLine(null);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!stocktake) return;
    Alert.alert(
      'Отправить на утверждение?',
      `Подсчитано ${stats.counted} из ${stats.total}.${
        stats.counted < stats.total ? ' Есть несосчитанные строки.' : ''
      }`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отправить',
          onPress: async () => {
            try {
              await submitStocktake(stocktake.id);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось отправить');
            }
          },
        },
      ],
    );
  };

  const handleApprove = async () => {
    if (!stocktake || !user) return;
    Alert.alert(
      'Утвердить инвентаризацию?',
      `${stats.variance} строк с расхождением будут зафиксированы в журнале.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Утвердить',
          onPress: async () => {
            try {
              await approveStocktake(stocktake.id, user.id);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось утвердить');
            }
          },
        },
      ],
    );
  };

  const handleCancel = async () => {
    if (!stocktake || !user) return;
    Alert.alert('Отменить инвентаризацию?', '', [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Отменить',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelStocktake(stocktake.id, user.id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось отменить');
          }
        },
      },
    ]);
  };

  if (loading || !stocktake) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={6} />;
  }

  const isOpen = stocktake.status === 'in_progress';
  const isAwaiting = stocktake.status === 'awaiting_approval';
  const editable = isOpen || isAwaiting;

  const renderLine = ({ item }: { item: StocktakeLine }) => {
    const counted = item.actual !== null && item.actual !== undefined;
    const variance = counted ? Number(item.variance ?? 0) : null;
    const varianceColor =
      variance == null
        ? undefined
        : variance < 0
          ? theme.colors.error
          : variance > 0
            ? theme.colors.tertiary
            : theme.colors.primary;
    return (
      <List.Item
        title={item.itemName}
        description={`Ожидается: ${item.expected} ${item.unit}${
          counted ? ` • Факт: ${item.actual} ${item.unit}` : ''
        }`}
        right={(props) =>
          counted ? (
            <View style={styles.right}>
              <Text style={{ color: varianceColor, fontWeight: '600' }}>
                {variance! > 0 ? '+' : ''}
                {variance}
              </Text>
              {editable && (
                <IconButton
                  {...props}
                  icon="pencil"
                  onPress={() => openEdit(item)}
                />
              )}
            </View>
          ) : (
            <Button
              {...props}
              compact
              onPress={() => openEdit(item)}
              disabled={!editable}
            >
              Учесть
            </Button>
          )
        }
      />
    );
  };

  return (
    <ScreenContainer maxWidth="grid">
      <Card mode="outlined" style={styles.headerCard}>
        <Card.Title
          title={stocktake.warehouse?.name ?? 'Инвентаризация'}
          subtitle={`${stats.counted}/${stats.total} учтено • ${stats.variance} с расхождением`}
        />
        <Card.Content>
          <View style={styles.row}>
            <Chip compact>{stocktake.status}</Chip>
            <Chip compact>{stocktake.kind === 'cycle' ? 'cycle' : 'full'}</Chip>
            {stocktake.category && (
              <Chip compact>{stocktake.category}</Chip>
            )}
          </View>
        </Card.Content>
        {editable && (
          <Card.Actions>
            <Button onPress={handleCancel} textColor={theme.colors.error}>
              Отменить
            </Button>
            {isOpen ? (
              <Button mode="contained" onPress={handleSubmit}>
                На утверждение
              </Button>
            ) : (
              <Button mode="contained" onPress={handleApprove}>
                Утвердить
              </Button>
            )}
          </Card.Actions>
        )}
      </Card>

      <FlatList
        data={stocktake.lines ?? []}
        keyExtractor={(l) => l.id}
        renderItem={renderLine}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="clipboard-list" title="Нет позиций для подсчёта" />
        }
      />

      <Portal>
        <Dialog
          visible={!!editingLine}
          onDismiss={() => setEditingLine(null)}
        >
          <Dialog.Title>{editingLine?.itemName}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogMeta}>
              Ожидается: {editingLine?.expected} {editingLine?.unit}
            </Text>
            <TextInput
              mode="outlined"
              label={`Фактический остаток (${editingLine?.unit ?? ''})`}
              keyboardType="decimal-pad"
              value={actualText}
              onChangeText={setActualText}
              style={styles.input}
            />
            {editingLine &&
              actualText !== '' &&
              Number(actualText) !==
                Number(editingLine.expected) && (
                <>
                  <Text variant="labelMedium" style={styles.label}>
                    Причина расхождения
                  </Text>
                  <View style={styles.chipRow}>
                    {(Object.keys(REASON_LABEL) as VarianceReason[]).map(
                      (r) => (
                        <Button
                          key={r}
                          compact
                          mode={reason === r ? 'contained' : 'outlined'}
                          onPress={() => setReason(r)}
                          style={styles.chipBtn}
                        >
                          {REASON_LABEL[r]}
                        </Button>
                      ),
                    )}
                  </View>
                </>
              )}
            <TextInput
              mode="outlined"
              label="Примечание"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditingLine(null)}>Отмена</Button>
            <Button
              onPress={handleSaveCount}
              loading={saving}
              disabled={!actualText || Number(actualText) < 0 || saving}
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
  headerCard: { margin: 12, marginBottom: 0 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  list: { padding: 12 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dialogMeta: { marginBottom: 8, opacity: 0.7 },
  input: { marginBottom: 12 },
  label: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chipBtn: { marginRight: 4, marginBottom: 4 },
});
