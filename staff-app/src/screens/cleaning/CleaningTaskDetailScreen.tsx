import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  Checkbox,
  TextInput,
  Divider,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {
  getCleaningTask,
  listChecklistTemplates,
  startCleaningTask,
  submitCleaningTask,
  type CleaningTask,
  type CleaningChecklistTemplate,
} from '../../api/cleaning';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CleaningStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CleaningStackParamList, 'CleaningTaskDetail'> & {
  /** Master-detail mode: bypasses route.params for SplitView. */
  taskIdOverride?: string;
};

const TYPE_LABEL: Record<string, string> = {
  departure: 'После выезда',
  stayover: 'Текущая уборка',
  deep: 'Генеральная',
  inspection: 'Инспекция',
};

export default function CleaningTaskDetailScreen({
  route,
  navigation,
  taskIdOverride,
}: Props) {
  const taskId = taskIdOverride ?? route?.params?.taskId;
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();

  const [task, setTask] = useState<CleaningTask | null>(null);
  const [template, setTemplate] = useState<CleaningChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  const fetchTask = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const t = await getCleaningTask(taskId);
      setTask(t);
      setNotes(t.notes || '');
      setChecks(t.checklistResult || {});
      if (t.templateId) {
        const templates = await listChecklistTemplates();
        const found = templates.find((tpl) => tpl.id === t.templateId);
        setTemplate(found || null);
      }
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить задачу', 'error');
    } finally {
      setLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleStart = async () => {
    if (!task) return;
    setBusy(true);
    try {
      const updated = await startCleaningTask(task.id);
      setTask(updated);
      toast.show('Задача начата', 'success');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось начать задачу');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!task) return;
    if (template) {
      const missing = template.items
        .filter((it) => it.required && !checks[it.key])
        .map((it) => it.label);
      if (missing.length > 0) {
        Alert.alert(
          'Чек-лист не завершён',
          `Не отмечено:\n${missing.join('\n')}`,
        );
        return;
      }
    }
    setBusy(true);
    try {
      const updated = await submitCleaningTask(task.id, {
        checklistResult: checks,
        notes: notes.trim() || undefined,
      });
      setTask(updated);
      toast.show('Передано на инспекцию', 'success');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось отправить');
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

  const isMine = !task.assignedTo || task.assignedTo === user?.id;
  const canStart = task.status === 'pending' && isMine;
  const canSubmit = task.status === 'in-progress' && isMine;
  const isTerminal = task.status === 'done' || task.status === 'skipped';

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
            {TYPE_LABEL[task.type] || task.type}
          </Text>
          <Divider style={{ marginVertical: 12 }} />
          <Text variant="bodySmall">Статус: {task.status}</Text>
          {task.assignedToName ? (
            <Text variant="bodySmall">Исполнитель: {task.assignedToName}</Text>
          ) : (
            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
              Не назначено
            </Text>
          )}
          {task.startedAt ? (
            <Text variant="bodySmall">
              Начато: {new Date(task.startedAt).toLocaleString('ru-RU')}
            </Text>
          ) : null}
          {task.completedAt ? (
            <Text variant="bodySmall">
              Завершено: {new Date(task.completedAt).toLocaleString('ru-RU')}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {template ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
              {template.name}
            </Text>
            <Divider style={{ marginVertical: 8 }} />
            {template.items.map((item) => (
              <Checkbox.Item
                key={item.key}
                label={
                  item.label + (item.required ? ' *' : '')
                }
                status={checks[item.key] ? 'checked' : 'unchecked'}
                onPress={() =>
                  setChecks((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                disabled={!canSubmit && !isTerminal}
                position="leading"
                labelStyle={{ flex: 1, fontSize: 14 }}
              />
            ))}
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 8 }}>
            Заметки
          </Text>
          <TextInput
            mode="outlined"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            disabled={!canSubmit && !canStart}
            placeholder="Найденные повреждения, проблемы..."
          />
        </Card.Content>
      </Card>

      {canStart ? (
        <Button
          mode="contained"
          onPress={handleStart}
          loading={busy}
          disabled={busy}
          style={styles.actionButton}
          icon="play"
        >
          Начать уборку
        </Button>
      ) : null}

      {canSubmit ? (
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={busy}
          disabled={busy}
          style={styles.actionButton}
          icon="check"
        >
          Передать на инспекцию
        </Button>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 10, borderRadius: 12 },
  actionButton: { marginTop: 12, borderRadius: 8 },
});
