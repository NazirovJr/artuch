import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, Chip, Divider, useTheme } from 'react-native-paper';
import {
  getExceptionsSummary,
  ExceptionsSummary,
} from '../../api/exceptions';

/**
 * Owner-oriented dashboard. Aggregates the four most common loss-prevention
 * signals: who refunds the most, who discounts the most, which shifts came
 * up short, and which protected orders were edited after the fact.
 */
export default function ExceptionsScreen() {
  const theme = useTheme();
  const [summary, setSummary] = useState<ExceptionsSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExceptionsSummary();
      setSummary(data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const fmt = (n: number) => `${(n || 0).toFixed(2)} TJS`;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchSummary} />
      }
    >
      <Card style={styles.card}>
        <Card.Title title="Возвраты по сотрудникам" />
        <Card.Content>
          {summary?.refunds.length ? (
            summary.refunds.map((r) => (
              <View key={r.employeeId} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {r.employeeName || r.employeeId.slice(0, 8)}
                </Text>
                <View style={styles.rowRight}>
                  <Chip compact style={styles.countChip}>
                    {r.count}
                  </Chip>
                  <Text style={styles.amount}>{fmt(r.totalAmount)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Нет данных</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Скидки по сотрудникам" />
        <Card.Content>
          {summary?.discounts.length ? (
            summary.discounts.map((d) => (
              <View key={d.employeeId || 'unknown'} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {d.employeeId
                    ? d.employeeId.slice(0, 8)
                    : '—'}
                </Text>
                <View style={styles.rowRight}>
                  <Chip compact style={styles.countChip}>
                    {d.count}
                  </Chip>
                  <Text style={styles.amount}>{fmt(d.totalAmount)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Нет данных</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Расхождения кассы" />
        <Card.Content>
          {summary?.variances.length ? (
            summary.variances.map((v) => (
              <View key={v.id} style={styles.varianceRow}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>
                    {v.userName || v.userId.slice(0, 8)}
                  </Text>
                  <Text
                    style={[
                      styles.amount,
                      {
                        color:
                          v.variance < 0 ? '#EF4444' : '#10B981',
                      },
                    ]}
                  >
                    {v.variance > 0 ? '+' : ''}
                    {fmt(v.variance)}
                  </Text>
                </View>
                <Text variant="labelSmall" style={styles.subline}>
                  {formatDate(v.closedAt)} · ожид {fmt(v.expectedCash)} / факт{' '}
                  {fmt(v.actualCash)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Нет данных</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Изменения защищённых заказов" />
        <Card.Content>
          {summary?.orderEdits.length ? (
            summary.orderEdits.map((e) => (
              <View key={e.id} style={styles.varianceRow}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>
                    {e.changedByName || e.changedBy.slice(0, 8)}
                  </Text>
                  <Text style={styles.amount}>
                    {fmt(e.oldTotal)} → {fmt(e.newTotal)}
                  </Text>
                </View>
                <Text variant="labelSmall" style={styles.subline}>
                  {formatDate(e.createdAt)} · статус {e.orderStatusAtEdit}
                  {e.approvedBy ? ` · одобрил ${e.approvedBy.slice(0, 8)}` : ''}
                </Text>
                {!!e.reason && (
                  <Text variant="labelSmall" style={styles.subline}>
                    Причина: {e.reason}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Нет данных</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Пропущенные уборки" />
        <Card.Content>
          {summary?.skippedCleaning.length ? (
            summary.skippedCleaning.map((s) => (
              <View key={s.id} style={styles.varianceRow}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>
                    Номер {s.roomNumber} · {s.type}
                  </Text>
                  <Text variant="labelSmall" style={styles.subline}>
                    {formatDate(s.completedAt)}
                  </Text>
                </View>
                {!!s.notes && (
                  <Text variant="labelSmall" style={styles.subline}>
                    {s.notes}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Нет данных</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
  card: { marginBottom: 12, borderRadius: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontWeight: '500', flex: 1 },
  countChip: { height: 24 },
  amount: { fontWeight: 'bold' },
  varianceRow: { paddingVertical: 6 },
  subline: { opacity: 0.6, marginTop: 2 },
  empty: { opacity: 0.5, paddingVertical: 8 },
});
