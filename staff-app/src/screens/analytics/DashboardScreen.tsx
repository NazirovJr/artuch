/**
 * DashboardScreen — bento analytics overview for admins/managers/owners.
 *
 * Differs from HomeScreen: this is *deep* analytics (multi-chart), while
 * Home is a role-aware shortcut board. Both live as separate drawer routes
 * so users choose their perspective.
 *
 * Layout:
 *   - Hero: today revenue with 7-day sparkline
 *   - Row: active orders | pending reservations (KPIs)
 *   - Row: occupancy donut | top items horizontal bars
 *   - Row: revenue breakdown (day/week/month toggle) — future iteration
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import { getKpi, getRevenue, getTopItems } from '../../api/analytics';
import { useAppTheme } from '../../hooks/useAppTheme';
import { BentoSection } from '../../components/bento/BentoGrid';
import BentoCard from '../../components/bento/BentoCard';
import Sparkline from '../../components/charts/Sparkline';
import BarMini from '../../components/charts/BarMini';
import Donut from '../../components/charts/Donut';
import { spacing } from '../../theme/spacing';
import { SkeletonCard } from '../../components/ui/Skeleton';

type Period = 'day' | 'week' | 'month';

interface Kpi {
  todayRevenue: number;
  activeOrders: number;
  occupiedRooms: number;
  totalRooms: number;
  pendingReservations: number;
}

interface RevenuePoint {
  period: string;
  revenue: number;
  count: number;
}

interface TopItem {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} TJS`;

export default function DashboardScreen() {
  const theme = useAppTheme();
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [period, setPeriod] = useState<Period>('day');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(
    async (nextPeriod: Period) => {
      try {
        const [kpiData, revenueData, topData] = await Promise.all([
          getKpi(),
          getRevenue(nextPeriod),
          getTopItems(5),
        ]);
        setKpi(kpiData as Kpi);
        // API returns most-recent-first; reverse for left-to-right sparkline.
        setRevenue([...(revenueData as RevenuePoint[])].reverse());
        setTopItems(topData as TopItem[]);
      } catch {
        /* best effort — blocks render empty states */
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadAll(period);
  }, [loadAll, period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll(period);
    setRefreshing(false);
  }, [loadAll, period]);

  const sparkValues = revenue.map((r) => r.revenue);
  const occupancyPct = kpi && kpi.totalRooms > 0 ? kpi.occupiedRooms / kpi.totalRooms : 0;

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard withAvatar />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Period switcher */}
      <View style={styles.periodRow}>
        <SegmentedButtons
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
          buttons={[
            { value: 'day', label: 'День' },
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
          ]}
        />
      </View>

      {/* Hero: today revenue + sparkline */}
      <BentoSection title="Ключевые метрики">
        <BentoCard
          title="Выручка сегодня"
          value={kpi ? fmtMoney(kpi.todayRevenue) : '—'}
          subtitle={revenue.length > 0 ? `Тренд за ${revenue.length} ${labelForPeriod(period, revenue.length)}` : undefined}
          size="wide"
          tone="primary"
          icon="cash-multiple"
          delay={0}
        >
          <Sparkline values={sparkValues} color={theme.colors.onPrimary} />
        </BentoCard>

        <BentoCard
          title="Активные заказы"
          value={kpi?.activeOrders ?? 0}
          subtitle="В работе / ожидают"
          size="sm"
          tone="tonal"
          icon="food-fork-drink"
          delay={60}
        />

        <BentoCard
          title="Брони"
          value={kpi?.pendingReservations ?? 0}
          subtitle="Ожидают подтверждения"
          size="sm"
          tone="accent"
          icon="calendar-check"
          delay={120}
        />
      </BentoSection>

      {/* Occupancy + Top items */}
      <BentoSection title="Загрузка и продажи">
        <BentoCard
          title="Загрузка номеров"
          size="tall"
          tone="neutral"
          icon="bed"
          delay={0}
        >
          <View style={styles.centered}>
            <Donut
              value={occupancyPct}
              size={140}
              strokeWidth={14}
              label={kpi ? `${kpi.occupiedRooms} из ${kpi.totalRooms}` : undefined}
              color={theme.colors.tertiary}
            />
          </View>
        </BentoCard>

        <BentoCard
          title="Топ позиций"
          size="tall"
          tone="neutral"
          icon="trophy"
          delay={60}
        >
          <BarMini
            data={topItems.map((i) => ({ label: i.name, value: i.totalQuantity }))}
            color={theme.colors.secondary}
            formatValue={(v) => `${v}×`}
          />
        </BentoCard>
      </BentoSection>

      {/* Revenue detail list */}
      <BentoSection title={`Выручка по ${labelForPeriod(period, 2, true)}`}>
        <BentoCard
          title={`Последние ${revenue.length} ${labelForPeriod(period, revenue.length)}`}
          size="wide"
          tone="neutral"
          icon="chart-line"
          delay={0}
        >
          <BarMini
            data={revenue.slice(-7).map((r) => ({
              label: formatPeriodLabel(r.period, period),
              value: r.revenue,
            }))}
            color={theme.colors.primary}
            limit={7}
            formatValue={fmtMoney}
          />
        </BentoCard>
      </BentoSection>
    </ScrollView>
  );
}

function labelForPeriod(period: Period, count: number, prepositional = false): string {
  if (prepositional) {
    return period === 'day' ? 'дням' : period === 'week' ? 'неделям' : 'месяцам';
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (period === 'day') {
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
    return 'дней';
  }
  if (period === 'week') {
    if (mod10 === 1 && mod100 !== 11) return 'неделя';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'недели';
    return 'недель';
  }
  if (mod10 === 1 && mod100 !== 11) return 'месяц';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'месяца';
  return 'месяцев';
}

function formatPeriodLabel(iso: string, period: Period): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  if (period === 'day') return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (period === 'month') return d.toLocaleString('ru-RU', { month: 'short' });
  // week — show start-of-week date
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  periodRow: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
