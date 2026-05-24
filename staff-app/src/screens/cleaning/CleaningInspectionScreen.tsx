import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  Divider,
  TextInput,
  useTheme,
  ActivityIndicator,
  List,
} from 'react-native-paper';
import {
  getCleaningTask,
  listChecklistTemplates,
  approveCleaningTask,
  rejectCleaningTask,
  type CleaningTask,
  type CleaningChecklistTemplate,
} from '../../api/cleaning';
import { useToast } from '../../components/ui/Toast';
import { semantic } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CleaningStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningInspection'>;

export default function CleaningInspectionScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const [task, setTask] = useState<CleaningTask | null>(null);
  const [template, setTemplate] = useState<CleaningChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showReject, setShowReject] = useState(false);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getCleaningTask(taskId);
      setTask(t);
      if (t.templateId) {
        const templates = await listChecklistTemplates();
        const found = templates.find((tpl) => tpl.id === t.templateId);
        setTemplate(found || null);
      }
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить', 'error');
    } finally {
      setLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleApprove = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await approveCleaningTask(task.id);
      toast.show('Уборка принята', 'success');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось принять');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!task) return;
    if (!rejectNotes.trim()) {
      Alert.alert('Ошибка', 'Укажите причину');
      return;
    }
    setBusy(true);
    try {
      await rejectCleaningTask(task.id, rejectNotes.trim());
      toast.show('Возвращено на доработку', 'success');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Задача не найдена</Text>
      </View>
    );
  }

  const checklist = task.checklistResult || {};

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
            Номер #{task.roomNumber}
          </Text>
          <Text variant="bodyMedium" style={{ opacity: 0.7, marginTop: 4 }}>
            Исполнитель: {task.assignedToName || '—'}
          </Text>
          <Divider style={{ marginVertical: 12 }} />
          {task.startedAt ? (
            <Text variant="bodySmall">
              Начато: {new Date(task.startedAt).toLocaleString('ru-RU')}
            </Text>
          ) : null}
          <Text variant="bodySmall">
            Длительность:{' '}
            {task.startedAt
              ? Math.round(
                  (new Date(task.updatedAt).getTime() -
                    new Date(task.startedAt).getTime()) /
                    60000,
                ) + ' мин'
              : '—'}
          </Text>
        </Card.Content>
      </Card>

      {template ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
              Чек-лист ({template.name})
            </Text>
            <Divider style={{ marginVertical: 8 }} />
            {template.items.map((item) => (
              <List.Item
                key={item.key}
                title={item.label}
                left={() => (
                  <List.Icon
                    icon={
                      checklist[item.key]
                        ? 'check-circle'
                        : item.required
                        ? 'close-circle'
                        : 'minus-circle'
                    }
                    color={
                      checklist[item.key]
                        ? semantic.success
                        : item.required
                        ? semantic.error
                        : theme.colors.outline
                    }
                  />
                )}
              />
            ))}
          </Card.Content>
        </Card>
      ) : null}

      {task.notes ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
              Заметки исполнителя
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 6 }}>
              {task.notes}
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      {showReject ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Причина возврата
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={3}
              value={rejectNotes}
              onChangeText={setRejectNotes}
              placeholder="Что нужно переделать..."
            />
            <View style={styles.rejectRow}>
              <Button onPress={() => setShowReject(false)} disabled={busy}>
                Отмена
              </Button>
              <Button
                mode="contained"
                onPress={handleReject}
                loading={busy}
                disabled={busy || !rejectNotes.trim()}
                buttonColor={semantic.error}
              >
                Вернуть
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {!showReject ? (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => setShowReject(true)}
            disabled={busy}
            style={styles.actionButton}
            icon="close"
            textColor={semantic.error}
          >
            Вернуть
          </Button>
          <Button
            mode="contained"
            onPress={handleApprove}
            loading={busy}
            disabled={busy}
            style={styles.actionButton}
            icon="check"
            buttonColor={semantic.success}
          >
            Принять
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 10, borderRadius: 12 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionButton: { flex: 1, borderRadius: 8 },
  rejectRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 8 },
});
