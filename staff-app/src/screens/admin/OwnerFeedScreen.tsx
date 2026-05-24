import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import { getOwnerFeed, OwnerFeedItem } from '../../api/exceptions';
import { useSocketEvent } from '../../socket/useSocketEvent';
import { semantic } from '../../theme/colors';

const SEVERITY_COLOR: Record<string, string> = {
  critical: semantic.error,
  warning: semantic.warning,
  info: semantic.info,
};

interface RiskyAction {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail?: string;
  actorId?: string;
  actorName?: string;
  amount?: number;
  subjectId?: string;
  subject?: string;
  createdAt: string;
}

export default function OwnerFeedScreen() {
  const theme = useTheme();
  const [logs, setLogs] = useState<OwnerFeedItem[]>([]);
  const [risky, setRisky] = useState<RiskyAction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOwnerFeed(50);
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

  useSocketEvent<RiskyAction>('risky:action', (payload) => {
    setRisky((prev) => [payload, ...prev].slice(0, 20));
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderRisky = (item: RiskyAction, idx: number) => (
    <Card
      key={`risky-${idx}-${item.createdAt}`}
      style={[
        styles.card,
        styles.riskyCard,
        { borderLeftColor: SEVERITY_COLOR[item.severity] || '#999' },
      ]}
    >
      <Card.Content>
        <View style={styles.row}>
          <Chip
            compact
            style={{ backgroundColor: SEVERITY_COLOR[item.severity] || '#999' }}
            textStyle={{ color: '#fff', fontSize: 10 }}
          >
            {item.severity.toUpperCase()}
          </Chip>
          <Text variant="labelSmall" style={styles.date}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Text variant="titleSmall" style={styles.title}>
          {item.title}
        </Text>
        {!!item.detail && (
          <Text variant="bodySmall" style={styles.detail}>
            {item.detail}
          </Text>
        )}
        {!!item.actorName && (
          <Text variant="labelSmall" style={styles.actor}>
            {item.actorName}
            {item.amount != null ? ` • ${item.amount.toFixed(2)} TJS` : ''}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderLog = ({ item }: { item: OwnerFeedItem }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <Text variant="labelSmall" style={styles.date}>
            {formatDate(item.createdAt)}
          </Text>
          {!!item.ipAddress && (
            <Text variant="labelSmall" style={styles.ip}>
              {item.ipAddress}
            </Text>
          )}
        </View>
        <Text variant="titleSmall" style={styles.userName}>
          {item.userName || 'system'}
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
      {risky.length > 0 && (
        <View style={styles.riskySection}>
          <Text variant="labelLarge" style={styles.sectionTitle}>
            🚨 Подозрительные операции (live)
          </Text>
          {risky.map((r, i) => renderRisky(r, i))}
        </View>
      )}
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLog}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchLogs} />
        }
        ListHeaderComponent={
          <Text variant="labelLarge" style={styles.sectionTitle}>
            История критичных действий
          </Text>
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
  riskyCard: { borderLeftWidth: 4 },
  riskySection: { padding: 12, paddingBottom: 0 },
  sectionTitle: { marginBottom: 8, opacity: 0.7 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { opacity: 0.5 },
  ip: { opacity: 0.4 },
  title: { fontWeight: '600', marginTop: 6 },
  detail: { marginTop: 4, opacity: 0.7 },
  actor: { marginTop: 6, opacity: 0.6 },
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
