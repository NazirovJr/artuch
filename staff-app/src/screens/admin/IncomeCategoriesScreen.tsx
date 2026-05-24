import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { List, FAB, Chip, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import {
  getIncomeCategories,
  INCOME_GROUPS,
  type IncomeCategory,
} from '../../api/incomes';
import { useToast } from '../../components/ui/Toast';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'IncomeCategories'>;

const GROUP_LABELS: Record<string, string> = Object.fromEntries(
  INCOME_GROUPS.map((g) => [g.value, g.label]),
);

export default function IncomeCategoriesScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await getIncomeCategories(true));
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить категории', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  if (loading && categories.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LoadingSkeleton count={6} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={GROUP_LABELS[item.group] || item.group}
            titleStyle={!item.isActive ? styles.inactive : undefined}
            left={(props) => <List.Icon {...props} icon={item.icon || 'tag-outline'} />}
            onPress={() => navigation.navigate('IncomeCategoryForm', { categoryId: item.id })}
            right={() =>
              !item.isActive ? (
                <Chip compact style={styles.chip}>
                  скрыта
                </Chip>
              ) : item.isSystem ? (
                <Chip compact style={styles.chip}>
                  систем.
                </Chip>
              ) : null
            }
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Категорий нет</Text>}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
      />
      <FAB
        icon="plus"
        label="Категория"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('IncomeCategoryForm', {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 96 },
  inactive: { opacity: 0.5, textDecorationLine: 'line-through' },
  chip: { alignSelf: 'center' },
  empty: { textAlign: 'center', marginTop: 32, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 28 },
});
