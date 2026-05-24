import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  FAB,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import EmptyState from '../../components/ui/EmptyState';
import { getOpenChecks, openCheck, type TableCheck } from '../../api/checks';
import { useToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../store/authStore';
import type { BarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarStackParamList, 'BarChecks'>;

export default function BarChecksScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuthStore();

  const [checks, setChecks] = useState<TableCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getOpenChecks();
      setChecks(all);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const handleNew = useCallback(async () => {
    setCreating(true);
    try {
      const check = await openCheck({
        tableNumber: 'Стойка',
        openedByName: user?.fullName || user?.username,
      });
      navigation.navigate('BarCheckDetail', { checkId: check.id });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось открыть счёт');
    } finally {
      setCreating(false);
    }
  }, [navigation, user]);

  return (
    <ScreenContainer>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : checks.length === 0 ? (
        <EmptyState icon="receipt" title="Нет открытых счётов" />
      ) : (
        <FlatList
          data={checks}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Surface
              key={item.id}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              elevation={1}
              onTouchEnd={() => navigation.navigate('BarCheckDetail', { checkId: item.id })}
            >
              <Text variant="titleSmall">Счёт #{item.checkNumber} · {item.tableNumber}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {Number(item.total).toFixed(2)} TJS · {item.orders?.length ?? 0} раунда
              </Text>
            </Surface>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={styles.list}
        />
      )}
      <FAB
        icon="plus"
        label="Новый счёт"
        style={styles.fab}
        onPress={handleNew}
        loading={creating}
        disabled={creating}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingBottom: 80 },
  card: { borderRadius: 10, padding: 14 },
  fab: { position: 'absolute', bottom: 16, right: 16 },
});
