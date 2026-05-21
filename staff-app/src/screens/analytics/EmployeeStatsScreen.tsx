import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { getEmployeeStats } from '../../api/analytics';

export default function EmployeeStatsScreen() {
  const theme = useTheme();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmployeeStats();
      setEmployees(data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.name}>
          {item.employeeName}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text variant="titleSmall" style={styles.statValue}>
              {item.transactionCount}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Продаж
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="titleSmall" style={[styles.statValue, { color: '#10B981' }]}>
              {item.totalRevenue.toLocaleString('ru-RU')} TJS
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Выручка
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={employees}
        keyExtractor={(item) => item.employeeId || item.employeeName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={{ opacity: 0.5 }}>
                Нет данных
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 24 },
  card: { marginBottom: 10, borderRadius: 12 },
  name: { fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 24,
  },
  stat: {},
  statValue: { fontWeight: '600' },
  statLabel: { opacity: 0.5, marginTop: 2 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
