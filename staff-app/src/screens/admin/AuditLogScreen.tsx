import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { getAuditLog } from '../../api/audit';

export default function AuditLogScreen() {
  const theme = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLog();
      setLogs(data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <Text variant="labelSmall" style={styles.date}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Text variant="titleSmall" style={styles.userName}>
          {item.userName}
        </Text>
        <View style={styles.actionRow}>
          <Text variant="bodyMedium" style={styles.action}>
            {item.action}
          </Text>
          <Text variant="bodySmall" style={styles.subject}>
            {item.subject}
            {item.subjectId ? ` #${item.subjectId.slice(0, 8)}` : ''}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchLogs} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={{ opacity: 0.5 }}>
                Нет записей
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
  card: { marginBottom: 8, borderRadius: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { opacity: 0.5 },
  userName: { fontWeight: 'bold', marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  action: { fontWeight: '600' },
  subject: { opacity: 0.6 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
