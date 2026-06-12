import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Platform, Pressable } from 'react-native';
import {
  Card,
  Text,
  TextInput,
  SegmentedButtons,
  Button,
  ActivityIndicator,
  Divider,
  Chip,
  Badge,
  useTheme,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Donut from '../../components/charts/Donut';
import BarMini from '../../components/charts/BarMini';
import Sparkline from '../../components/charts/Sparkline';
import CompareLines from '../../components/charts/CompareLines';
import {
  getFinanceSummary,
  exportFinanceXlsx,
  type FinanceSummary,
  type FinanceScope,
} from '../../api/finance';
import FinanceFilters, {
  countActiveFilters,
  type FinanceFilterValues,
} from '../../components/finance/FinanceFilters';
import { buildFinanceReportHtml } from '../../utils/financeReportHtml';
import { printHtmlDocument } from '../../utils/saveFile';
import { useToast } from '../../components/ui/Toast';
import { semantic } from '../../theme/colors';

const PERIODS = [
  { value: '7', label: '7 дн' },
  { value: '30', label: '30 дн' },
  { value: '90', label: '90 дн' },
  { value: 'month', label: 'Месяц' },
  { value: 'custom', label: 'Период' },
];

const fmtISO = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const parseISO = (raw: string): Date | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

function computeRange(key: string): { from: string; to: string } {
  const now = new Date();
  const from =
    key === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getTime() - Number(key) * 86_400_000);
  return { from: from.toISOString(), to: now.toISOString() };
}

// Show 2 decimals so the dashboard matches the backend's decimal totals
// (previously Math.round hid fractional TJS — e.g. 100.50 read as "101").
const money = (n: number) =>
  `${(Number(n) || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TJS`;
const pct = (n: number) => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString('ru-RU')}%`;

type ChartMetric = 'revenue' | 'count' | 'avg';
type DayPoint = { revenue: number; count: number };

/** Project daily points onto the selected metric for the overlay chart. */
function seriesFor(points: DayPoint[], metric: ChartMetric): number[] {
  return points.map((p) =>
    metric === 'revenue' ? p.revenue : metric === 'count' ? p.count : p.count > 0 ? p.revenue / p.count : 0,
  );
}

/** Period total for the selected metric (avg = total revenue / total count). */
function totalFor(points: DayPoint[], metric: ChartMetric): number {
  const rev = points.reduce((a, p) => a + p.revenue, 0);
  const cnt = points.reduce((a, p) => a + p.count, 0);
  return metric === 'revenue' ? rev : metric === 'count' ? cnt : cnt > 0 ? rev / cnt : 0;
}

export default function FinanceScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [period, setPeriod] = useState('30');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue');
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000));
  const [customTo, setCustomTo] = useState(() => new Date());
  // Lens narrows the dashboard to one side of the P&L; sub-modes drill into a
  // single module (manual journals) inside the broad lens.
  const [lens, setLens] = useState<FinanceScope>('all');
  const [incomeSub, setIncomeSub] = useState<'all' | 'other'>('all');
  const [expenseSub, setExpenseSub] = useState<'all' | 'opex'>('all');
  const [filters, setFilters] = useState<FinanceFilterValues>({});
  const [filtersVisible, setFiltersVisible] = useState(false);
  const activeFilterCount = countActiveFilters(filters);

  const range = useMemo(() => {
    if (period === 'custom') {
      const f = new Date(customFrom);
      f.setHours(0, 0, 0, 0);
      const t = new Date(customTo);
      t.setHours(23, 59, 59, 999);
      return { from: f.toISOString(), to: t.toISOString() };
    }
    return computeRange(period);
  }, [period, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await getFinanceSummary(range.from, range.to, {
          outletId: filters.outletId,
          paymentMethod: filters.paymentMethod,
        }),
      );
    } catch (e: any) {
      toast.show(e.message || 'Не удалось загрузить финансы', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, filters.outletId, filters.paymentMethod, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportFinanceXlsx({
        from: range.from,
        to: range.to,
        scope: lens,
        outletId: filters.outletId,
        paymentMethod: filters.paymentMethod,
      });
      toast.show('Отчёт XLSX готов', 'success');
    } catch (e: any) {
      toast.show(e.message || 'Не удалось выгрузить отчёт', 'error');
    } finally {
      setExporting(false);
    }
  }, [range, lens, filters.outletId, filters.paymentMethod, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!data) return;
    setExportingPdf(true);
    try {
      await printHtmlDocument(buildFinanceReportHtml(data, lens), 'Финансовый отчёт');
    } catch (e: any) {
      toast.show(e.message || 'Не удалось сформировать PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  }, [data, toast]);

  // The hero KPI reflects the active lens; in "all" it follows the metric
  // selector (revenue / count / avg) as before.
  const hero = useMemo((): {
    label: string;
    value: string;
    delta: number | null;
    series: number[];
    color?: string;
  } | null => {
    if (!data) return null;

    if (lens === 'income') {
      if (incomeSub === 'other') {
        return { label: 'Прочие доходы', value: money(data.otherIncome.total), delta: null, series: [], color: semantic.success };
      }
      const total = data.revenue.net + data.otherIncome.total;
      return {
        label: 'Совокупный доход',
        value: money(total),
        delta: data.comparison.deltaPct,
        series: seriesFor(data.comparison.current, 'revenue'),
        color: semantic.success,
      };
    }

    if (lens === 'expense') {
      const value = expenseSub === 'opex' ? data.expenses.total : data.cogs.cost + data.expenses.total;
      return {
        label: expenseSub === 'opex' ? 'Операционные затраты' : 'Совокупные расходы',
        value: money(value),
        delta: null,
        series: [],
        color: semantic.error,
      };
    }

    const { current, previous } = data.comparison;
    const series = seriesFor(current, chartMetric);
    if (chartMetric === 'count') {
      const c = current.reduce((a, p) => a + p.count, 0);
      const p = previous.reduce((a, b) => a + b.count, 0);
      return { label: 'Кол-во чеков', value: String(c), delta: p > 0 ? ((c - p) / p) * 100 : null, series };
    }
    if (chartMetric === 'avg') {
      const c = totalFor(current, 'avg');
      const p = totalFor(previous, 'avg');
      return { label: 'Средний чек', value: money(c), delta: p > 0 ? ((c - p) / p) * 100 : null, series };
    }
    return { label: 'Чистая выручка', value: money(data.revenue.net), delta: data.comparison.deltaPct, series };
  }, [data, lens, incomeSub, expenseSub, chartMetric]);
  const heroBg = hero?.color ?? theme.colors.primary;
  const heroDelta = hero?.delta ?? null;
  const deltaColor = heroDelta == null ? theme.colors.onSurfaceVariant : heroDelta >= 0 ? semantic.success : semantic.error;

  // Section visibility per lens.
  const showIncomeSide = lens !== 'expense';
  const showExpenseSide = lens !== 'income';
  const incomeFull = lens === 'all' || (lens === 'income' && incomeSub === 'all');
  const expenseFull = lens === 'all' || (lens === 'expense' && expenseSub === 'all');
  const showComparison = lens !== 'expense' && !(lens === 'income' && incomeSub === 'other');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.controls}>
        <SegmentedButtons value={period} onValueChange={setPeriod} buttons={PERIODS} density="small" />
        {period === 'custom' && (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DateField label="С" value={customFrom} maxDate={customTo} onChange={setCustomFrom} />
            </View>
            <View style={styles.dateField}>
              <DateField label="По" value={customTo} minDate={customFrom} maxDate={new Date()} onChange={setCustomTo} />
            </View>
          </View>
        )}

        {/* Lens — which side of the P&L to show */}
        <SegmentedButtons
          value={lens}
          onValueChange={(v) => setLens(v as FinanceScope)}
          density="small"
          buttons={[
            { value: 'all', label: 'Всё', icon: 'chart-box' },
            { value: 'income', label: 'Доходы', icon: 'cash-plus' },
            { value: 'expense', label: 'Расходы', icon: 'cash-minus' },
          ]}
        />

        {/* Sub-mode — drill into a single module within the lens */}
        {lens === 'income' && (
          <SegmentedButtons
            value={incomeSub}
            onValueChange={(v) => setIncomeSub(v as 'all' | 'other')}
            density="small"
            buttons={[
              { value: 'all', label: 'Вся выручка' },
              { value: 'other', label: 'Прочие доходы' },
            ]}
          />
        )}
        {lens === 'expense' && (
          <SegmentedButtons
            value={expenseSub}
            onValueChange={(v) => setExpenseSub(v as 'all' | 'opex')}
            density="small"
            buttons={[
              { value: 'all', label: 'Все расходы' },
              { value: 'opex', label: 'Затраты' },
            ]}
          />
        )}

        {/* Metric — only meaningful for the revenue comparison chart */}
        {showComparison && (
          <SegmentedButtons
            value={chartMetric}
            onValueChange={(v) => setChartMetric(v as ChartMetric)}
            density="small"
            buttons={[
              { value: 'revenue', label: 'Выручка' },
              { value: 'count', label: 'Чеки' },
              { value: 'avg', label: 'Ср. чек' },
            ]}
          />
        )}

        <View style={styles.exportRow}>
          <View>
            <Button
              mode="outlined"
              icon="filter-variant"
              onPress={() => setFiltersVisible(true)}
              style={styles.exportBtn}
            >
              Фильтры
            </Button>
            {activeFilterCount > 0 && (
              <Badge style={styles.filterBadge}>{activeFilterCount}</Badge>
            )}
          </View>
          <Button
            mode="contained-tonal"
            icon="file-excel"
            loading={exporting}
            disabled={exporting || !data}
            onPress={handleExport}
            style={styles.exportBtn}
          >
            XLSX
          </Button>
          <Button
            mode="contained-tonal"
            icon="file-pdf-box"
            loading={exportingPdf}
            disabled={exportingPdf || !data}
            onPress={handleExportPdf}
            style={styles.exportBtn}
          >
            PDF
          </Button>
        </View>

        {activeFilterCount > 0 && (
          <View style={styles.chipsRow}>
            {filters.paymentMethod && (
              <Chip compact onClose={() => setFilters((f) => ({ ...f, paymentMethod: undefined }))}>
                Оплата: {filters.paymentMethod}
              </Chip>
            )}
            {filters.status && (
              <Chip compact onClose={() => setFilters((f) => ({ ...f, status: undefined }))}>
                Статус: {filters.status}
              </Chip>
            )}
            {filters.q && (
              <Chip compact onClose={() => setFilters((f) => ({ ...f, q: undefined }))}>
                «{filters.q}»
              </Chip>
            )}
            <Chip compact icon="close" onPress={() => setFilters({})}>
              Сбросить
            </Chip>
          </View>
        )}
      </View>

      <FinanceFilters
        visible={filtersVisible}
        onDismiss={() => setFiltersVisible(false)}
        value={filters}
        onApply={setFilters}
        kind={lens === 'income' ? 'income' : lens === 'expense' ? 'expense' : 'finance'}
      />

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={{ opacity: 0.5 }}>Нет данных</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
        >
          {/* KPI hero — reflects the selected metric */}
          {hero && (
            <Card style={[styles.card, { backgroundColor: heroBg }]}>
              <Card.Content>
                <Text variant="labelLarge" style={{ color: theme.colors.onPrimary, opacity: 0.85 }}>
                  {hero.label}
                </Text>
                <Text variant="displaySmall" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
                  {hero.value}
                </Text>
                {heroDelta != null && (
                  <Text variant="bodyMedium" style={{ color: deltaColor === semantic.error ? '#FECACA' : '#BBF7D0' }}>
                    {heroDelta >= 0 ? '▲' : '▼'} {pct(Math.abs(heroDelta))} к прошлому периоду
                  </Text>
                )}
                {hero.series.length > 1 && (
                  <Sparkline values={hero.series} color={theme.colors.onPrimary} height={64} />
                )}
              </Card.Content>
            </Card>
          )}

          {incomeFull && (
            <View style={styles.kpiRow}>
              <KpiMini label="Валовая" value={money(data.revenue.gross)} theme={theme} />
              <KpiMini label="Возвраты" value={money(data.revenue.refunds)} theme={theme} />
              <KpiMini label="Скидки" value={money(data.revenue.discounts)} theme={theme} />
            </View>
          )}

          {/* Period over period — metric chosen in the top control */}
          {showComparison && (
          <Section title="Период к периоду">
            <CompareLines
              current={seriesFor(data.comparison.current, chartMetric)}
              previous={seriesFor(data.comparison.previous, chartMetric)}
              height={130}
            />
            <Divider style={styles.divider} />
            {(() => {
              const cur = totalFor(data.comparison.current, chartMetric);
              const prev = totalFor(data.comparison.previous, chartMetric);
              const d = prev > 0 ? ((cur - prev) / prev) * 100 : null;
              const fmt = chartMetric === 'count' ? (n: number) => String(Math.round(n)) : money;
              return (
                <>
                  <Row label="Текущий период" value={fmt(cur)} bold />
                  <Row label="Прошлый период" value={fmt(prev)} />
                  {d != null && (
                    <Row label="Изменение" value={`${d >= 0 ? '▲ +' : '▼ '}${pct(Math.abs(d))}`} />
                  )}
                </>
              );
            })()}
          </Section>
          )}

          {/* Revenue by outlet */}
          {incomeFull && (
          <Section title="Выручка по точкам">
            <BarMini
              data={data.revenue.byOutlet.map((o) => ({ label: o.label, value: o.amount }))}
              limit={6}
              formatValue={money}
              color={lens === 'income' ? semantic.success : undefined}
            />
          </Section>
          )}

          {/* Payment methods */}
          {incomeFull && (
          <Section title="Способы оплаты">
            {data.revenue.byPaymentMethod.map((p) => (
              <Row key={p.method} label={p.label} value={money(p.amount)} />
            ))}
          </Section>
          )}

          {/* Top categories */}
          {incomeFull && (
          <Section title="Топ позиций">
            <BarMini
              data={data.revenue.byCategory.map((c) => ({ label: c.name, value: c.amount }))}
              limit={8}
              formatValue={money}
              color={lens === 'income' ? semantic.success : undefined}
            />
          </Section>
          )}

          {/* Rooms */}
          {incomeFull && (
          <Section title="Номера">
            <View style={styles.donutRow}>
              <Donut value={(data.rooms.occupancyRate || 0) / 100} label="загрузка" size={108} color={semantic.info} />
              <View style={styles.metrics}>
                <Row label="Выручка" value={money(data.rooms.revenue)} />
                <Row label="Номеро-ночи" value={String(data.rooms.roomNights)} />
                <Row label="ADR" value={money(data.rooms.adr)} />
                <Row label="RevPAR" value={money(data.rooms.revpar)} />
              </View>
            </View>
            {data.rooms.byRoomType.length > 0 && <Divider style={styles.divider} />}
            {data.rooms.byRoomType.map((t) => (
              <Row key={t.code} label={`${t.name} (${t.nights} ноч.)`} value={money(t.revenue)} />
            ))}
          </Section>
          )}

          {/* Rentals */}
          {incomeFull && (
          <Section title="Прокат">
            <Row label="Всего" value={money(data.rentals.revenue)} bold />
            {data.rentals.byItem.slice(0, 8).map((r) => (
              <Row key={r.itemName} label={`${r.itemName} ×${r.qty}`} value={money(r.revenue)} />
            ))}
          </Section>
          )}

          {/* Receivables */}
          {lens === 'all' && (
          <Section title="Дебиторка (оплачено vs к оплате)">
            <View style={styles.donutRow}>
              <Donut
                value={
                  data.receivables.paid + data.receivables.outstanding > 0
                    ? data.receivables.paid / (data.receivables.paid + data.receivables.outstanding)
                    : 0
                }
                label="оплачено"
                size={108}
                color={semantic.success}
              />
              <View style={styles.metrics}>
                <Row label="Оплачено" value={money(data.receivables.paid)} />
                <Row label="К оплате" value={money(data.receivables.outstanding)} bold />
                <Row label="Открытых фолио" value={String(data.receivables.openFolios)} />
                <Row label="Депозиты" value={money(data.receivables.depositsHeld)} />
              </View>
            </View>
            <Divider style={styles.divider} />
            {data.receivables.aging.map((a) => (
              <Row key={a.bucket} label={`${a.bucket} (${a.count})`} value={money(a.amount)} />
            ))}
          </Section>
          )}

          {/* COGS / margin */}
          {expenseFull && (
          <Section title="Себестоимость и маржа (товары)">
            <Row label="Выручка товаров" value={money(data.cogs.goodsRevenue)} />
            <Row label="Себестоимость" value={money(data.cogs.cost)} />
            <Row label="Валовая прибыль" value={money(data.cogs.grossProfit)} bold />
            <Row label="Маржа" value={pct(data.cogs.marginPct)} />
          </Section>
          )}

          {/* Operating expenses */}
          {showExpenseSide && (
          <Section title="Затраты">
            <Row label="Всего затрат" value={money(data.expenses.total)} bold />
            {data.expenses.byCategory.length > 0 && (
              <BarMini
                data={data.expenses.byCategory.map((c) => ({ label: c.name, value: c.amount }))}
                limit={8}
                formatValue={money}
                color={semantic.error}
              />
            )}
            {data.expenses.byPaymentMethod.length > 0 && <Divider style={styles.divider} />}
            {data.expenses.byPaymentMethod.map((p) => (
              <Row key={p.method} label={p.label} value={money(p.amount)} />
            ))}
          </Section>
          )}

          {/* Other income (manual inflows outside POS/rooms/rentals) */}
          {showIncomeSide && (
          <Section title="Прочие доходы">
            <Row label="Всего прочих доходов" value={money(data.otherIncome.total)} bold />
            {data.otherIncome.byCategory.length > 0 && (
              <BarMini
                data={data.otherIncome.byCategory.map((c) => ({ label: c.name, value: c.amount }))}
                limit={8}
                formatValue={money}
                color={semantic.success}
              />
            )}
            {data.otherIncome.byPaymentMethod.length > 0 && <Divider style={styles.divider} />}
            {data.otherIncome.byPaymentMethod.map((p) => (
              <Row key={p.method} label={p.label} value={money(p.amount)} />
            ))}
          </Section>
          )}

          {/* P&L — net profit */}
          {lens === 'all' && (
          <Card style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Прибыль (P&L)
              </Text>
              <Row label="Чистая выручка" value={money(data.revenue.net)} />
              <Row label="+ Прочие доходы" value={money(data.otherIncome.total)} />
              <Row label="− Себестоимость товаров" value={money(data.cogs.cost)} />
              <Row label="− Операционные затраты" value={money(data.expenses.total)} />
              <Divider style={styles.divider} />
              <View style={styles.profitRow}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                  Чистая прибыль
                </Text>
                <Text
                  variant="titleMedium"
                  style={{
                    fontWeight: '700',
                    color: data.profit.operatingProfit >= 0 ? semantic.success : semantic.error,
                  }}
                >
                  {money(data.profit.operatingProfit)}
                </Text>
              </View>
              <Row label="Рентабельность" value={pct(data.profit.marginPct)} />
            </Card.Content>
          </Card>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

function KpiMini({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <Card style={[styles.kpiMini, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Card.Content>
        <Text variant="bodySmall" style={{ opacity: 0.7 }}>
          {label}
        </Text>
        <Text variant="titleSmall" style={{ fontWeight: '700' }}>
          {value}
        </Text>
      </Card.Content>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          {title}
        </Text>
        {children}
      </Card.Content>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.rowItem}>
      <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ fontWeight: bold ? '700' : '500' }}>
        {value}
      </Text>
    </View>
  );
}

function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const display = fmtISO(value);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.dateWebWrap}>
        <TextInput
          mode="outlined"
          label={label}
          value={display}
          editable={false}
          dense
          right={<TextInput.Icon icon="calendar" forceTextInputFocus={false} />}
        />
        <input
          type="date"
          value={display}
          min={minDate ? fmtISO(minDate) : undefined}
          max={maxDate ? fmtISO(maxDate) : undefined}
          // Chromium needs showPicker() — a plain click on the field body
          // won't open the calendar popup (only the picker indicator does).
          onClick={(e) => {
            try {
              (e.currentTarget as any).showPicker?.();
            } catch {
              /* ignore */
            }
          }}
          onFocus={(e) => {
            try {
              (e.currentTarget as any).showPicker?.();
            } catch {
              /* ignore */
            }
          }}
          onChange={(e) => {
            const d = parseISO((e.target as HTMLInputElement).value);
            if (d) onChange(d);
          }}
          style={dateWebOverlay}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <TextInput
          mode="outlined"
          label={label}
          value={display}
          editable={false}
          dense
          right={<TextInput.Icon icon="calendar" forceTextInputFocus={false} />}
        />
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          minimumDate={minDate}
          maximumDate={maxDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(e, d) => {
            setOpen(false);
            if (e.type === 'set' && d) onChange(d);
          }}
        />
      )}
    </>
  );
}

// react-native-web renders a real DOM node here; this is exactly what an
// invisible <input type=date> overlay needs to capture taps.
const dateWebOverlay: any = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  // Above Paper's affix icons so the whole field captures the click.
  zIndex: 1,
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { padding: 12, gap: 10 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1 },
  dateWebWrap: { position: 'relative' },
  exportRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  exportBtn: { flex: 1, borderRadius: 8 },
  filterBadge: { position: 'absolute', top: -6, right: -6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 12, paddingTop: 0 },
  card: { marginBottom: 12, borderRadius: 12 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiMini: { flex: 1, borderRadius: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 10 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  metrics: { flex: 1, gap: 2 },
  divider: { marginVertical: 10 },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3, gap: 8 },
  profitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
});
