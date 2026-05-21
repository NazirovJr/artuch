import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  IconButton,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  LowStockAlert,
  acknowledgeAlert,
  getLowStockAlerts,
} from '../../api/alerts';
import { useAuthStore } from '../../store/authStore';

type Tab = 'open' | 'all';

export default function LowStockAlertsScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('open');
  const [acking, setAcking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLowStockAlerts(tab === 'all');
      setAlerts(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить алерты');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAck = async (alert: LowStockAlert) => {
    if (!user) return;
    setAcking(alert.id);
    try {
      await acknowledgeAlert(alert.id, user.id);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось подтвердить');
    } finally {
      setAcking(null);
    }
  };

  const renderItem = ({ item }: { item: LowStockAlert }) => {
    const isCritical = item.severity === 'critical';
    const color = isCritical ? theme.colors.error : theme.colors.tertiary;
    const acknowledged = !!item.acknowledgedAt;
    return (
      <Card
        mode="outlined"
        style={[
          styles.card,
          acknowledged && { opacity: 0.6 },
          { borderColor: color, borderLeftWidth: 4 },
        ]}
      >
        <Card.Title
          title={item.itemName}
          subtitle={`${item.source === 'warehouse' ? 'Склад' : 'POS'} • ${
            item.currentLevel
          } / порог ${item.threshold}`}
          right={(props) =>
            acknowledged ? (
              <IconButton {...props} icon="check-circle" iconColor={theme.colors.outline} />
            ) : (
              <Button
                {...props}
                compact
                loading={acking === item.id}
                onPress={() => handleAck(item)}
              >
                Подтвердить
              </Button>
            )
          }
        />
        <Card.Content>
          <View style={styles.row}>
            <Chip
              compact
              icon="alert"
              style={{ backgroundColor: color + '22' }}
              textStyle={{ color }}
            >
              {isCritical ? 'Критично' : 'Низкий'}
            </Chip>
            {acknowledged && (
              <Chip compact icon="check">
                Подтверждено
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={4} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <View style={styles.header}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'open', label: 'Открытые' },
            { value: 'all', label: 'Все' },
          ]}
        />
      </View>
      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="check-circle-outline"
            title={tab === 'open' ? 'Открытых алертов нет' : 'Нет алертов'}
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12 },
  list: { padding: 12, paddingBottom: 64 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
});
