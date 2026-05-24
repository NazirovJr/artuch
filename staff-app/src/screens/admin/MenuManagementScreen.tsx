import React, { useCallback, useState } from 'react';
import { View, SectionList, StyleSheet, RefreshControl } from 'react-native';
import { Text, List, Chip, FAB, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getMenuAdmin } from '../../api/menu';
import { useToast } from '../../components/ui/Toast';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { semantic, roleColors } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'MenuManagement'>;

const STATION_META: Record<string, { label: string; color: string }> = {
  kitchen: { label: 'Кухня', color: semantic.warning },
  bar: { label: 'Бар', color: roleColors.barman },
  none: { label: 'Сам', color: semantic.success },
};

export default function MenuManagementScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getMenuAdmin());
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить меню', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems]),
  );

  const sections = React.useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const it of items) {
      (grouped[it.category || 'other'] ||= []).push(it);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [items]);

  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <LoadingSkeleton count={6} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Text variant="titleSmall" style={styles.sectionHeader}>
            {title}
          </Text>
        )}
        renderItem={({ item }) => {
          const st = STATION_META[item.station || 'kitchen'];
          return (
            <List.Item
              title={item.nameRu || item.name}
              description={`${Number(item.price).toFixed(2)} TJS${item.isActive === false ? ' · скрыт' : ''}`}
              titleStyle={item.isActive === false ? styles.inactive : undefined}
              onPress={() => navigation.navigate('MenuItemForm', { itemId: item.id })}
              right={() => (
                <Chip compact style={[styles.chip, { backgroundColor: st?.color }]} textStyle={styles.chipText}>
                  {st?.label}
                </Chip>
              )}
            />
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchItems} />}
      />
      <FAB
        icon="plus"
        label="Позиция"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('MenuItemForm', {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 96 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontWeight: 'bold',
    textTransform: 'capitalize',
    opacity: 0.7,
  },
  inactive: { opacity: 0.5, textDecorationLine: 'line-through' },
  chip: { alignSelf: 'center' },
  chipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  fab: { position: 'absolute', right: 16, bottom: 16, borderRadius: 28 },
});
