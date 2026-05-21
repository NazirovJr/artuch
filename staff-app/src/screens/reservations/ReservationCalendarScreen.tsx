/**
 * ReservationCalendarScreen — two-mode room occupancy view.
 *
 *   - "gantt"   (default): horizontal Gantt of rooms × days, same window-shift
 *                 controls as before. Best for spotting free nights across
 *                 the whole property at a glance.
 *   - "agenda":  timeline (@howljs/calendar-kit) showing every check-in at
 *                 14:00 and check-out at 12:00 as events. Best for *today*
 *                 operational planning at reception.
 *
 * The toggle is a segmented control at the top so the receptionist can
 * flip perspectives without losing the selected date.
 *
 * Why both: Gantt answers "which rooms are free next week?"; Agenda answers
 * "who's arriving today and when?". One screen, two purposes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Text, Button, IconButton, SegmentedButtons } from 'react-native-paper';
import { addDays, format, isSameDay, startOfDay, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import CalendarKit, { type OnEventResponse, type EventItem } from '@howljs/calendar-kit';
import { getRooms } from '../../api/rooms';
import { getReservationsCalendar } from '../../api/reservations';
import { useAppTheme } from '../../hooks/useAppTheme';
import { reservationStatusColors, reservationStatusLabels, semantic } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { useHaptics } from '../../hooks/useHaptics';

const DAY_WIDTH = 56;
const ROW_HEIGHT = 44;
const ROOM_COL_WIDTH = 72;
const WINDOW_DAYS = 14;

type Mode = 'gantt' | 'agenda';

export default function ReservationCalendarScreen() {
  const theme = useAppTheme();
  const haptics = useHaptics();
  const [mode, setMode] = useState<Mode>('gantt');
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [windowStart, setWindowStart] = useState<Date>(() => startOfDay(new Date()));

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < WINDOW_DAYS; i++) out.push(addDays(windowStart, i));
    return out;
  }, [windowStart]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const from = format(days[0], 'yyyy-MM-dd');
      const to = format(addDays(days[days.length - 1], 1), 'yyyy-MM-dd');
      const [r, res] = await Promise.all([
        getRooms(),
        getReservationsCalendar({ from, to }),
      ]);
      setRooms((r || []).sort((a: any, b: any) => a.number - b.number));
      setReservations(res || []);
    } catch {
      /* best effort */
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const shift = (delta: number) => {
    haptics.light();
    setWindowStart((prev) => startOfDay(addDays(prev, delta)));
  };

  const monthLabel = `${format(days[0], 'd MMM', { locale: ru })} – ${format(
    days[days.length - 1],
    'd MMM',
    { locale: ru },
  )}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Mode switch + window controls */}
      <View style={styles.toolbar}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <SegmentedButtons
            value={mode}
            onValueChange={(v) => {
              haptics.selection();
              setMode(v as Mode);
            }}
            buttons={[
              { value: 'gantt', label: 'Сетка', icon: 'view-grid' },
              { value: 'agenda', label: 'Расписание', icon: 'clock-outline' },
            ]}
          />
        </View>

        {mode === 'gantt' && (
          <View style={styles.windowRow}>
            <IconButton icon="chevron-left" onPress={() => shift(-WINDOW_DAYS)} />
            <Text variant="titleMedium" style={styles.toolbarLabel}>
              {monthLabel}
            </Text>
            <IconButton icon="chevron-right" onPress={() => shift(WINDOW_DAYS)} />
            <Button
              compact
              onPress={() => {
                haptics.light();
                setWindowStart(startOfDay(new Date()));
              }}
            >
              Сегодня
            </Button>
          </View>
        )}
      </View>

      {mode === 'gantt' ? (
        <GanttView
          days={days}
          rooms={rooms}
          reservations={reservations}
          loading={loading}
          onRefresh={fetch}
        />
      ) : (
        <AgendaView
          date={windowStart}
          reservations={reservations}
          onDateChange={(d) => setWindowStart(startOfDay(d))}
        />
      )}
    </View>
  );
}

// ── Gantt view ─────────────────────────────────────────────────────

function GanttView({
  days,
  rooms,
  reservations,
  loading,
  onRefresh,
}: {
  days: Date[];
  rooms: any[];
  reservations: any[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const theme = useAppTheme();

  return (
    <ScrollView
      horizontal
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
    >
      <View>
        {/* Header row of days */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.roomCell,
              { backgroundColor: theme.colors.surfaceVariant, borderRightColor: theme.colors.outlineVariant },
            ]}
          >
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Номер
            </Text>
          </View>
          {days.map((d, i) => {
            const isToday = isSameDay(d, new Date());
            return (
              <View
                key={i}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: isToday
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceVariant,
                    borderRightColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={[
                    styles.dayLabel,
                    { color: isToday ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {format(d, 'EEEEEE', { locale: ru })}
                </Text>
                <Text
                  variant="labelMedium"
                  style={[
                    styles.dayNum,
                    { color: isToday ? theme.colors.onPrimaryContainer : theme.colors.onSurface },
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Room rows */}
        <ScrollView style={{ maxHeight: 600 }}>
          {rooms.map((room) => (
            <View
              key={room.number}
              style={[
                styles.gridRow,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
            >
              <View
                style={[
                  styles.roomCell,
                  { borderRightColor: theme.colors.outlineVariant },
                ]}
              >
                <Text
                  variant="labelLarge"
                  style={[styles.roomNum, { color: theme.colors.onSurface }]}
                >
                  #{room.number}
                </Text>
                <Text
                  variant="labelSmall"
                  style={[styles.roomType, { color: theme.colors.onSurfaceVariant }]}
                >
                  {room.type}
                </Text>
              </View>
              {days.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dayCell, { borderRightColor: theme.colors.outlineVariant }]}
                />
              ))}
              {/* Reservation bars */}
              {reservations
                .filter((r) => r.roomNumber === room.number)
                .map((r) => {
                  const span = computeSpan(r, days);
                  if (!span) return null;
                  const bg = reservationStatusColors[r.status] || semantic.neutral;
                  return (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.bar,
                        {
                          left: ROOM_COL_WIDTH + span.startCol * DAY_WIDTH + 2,
                          width: span.colCount * DAY_WIDTH - 4,
                          backgroundColor: bg,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Text numberOfLines={1} style={styles.barText}>
                        {r.guest
                          ? `${r.guest.firstName} ${r.guest.lastName}`
                          : reservationStatusLabels[r.status] || 'Гость'}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          ))}
          {rooms.length === 0 && !loading && (
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Нет данных
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

// ── Agenda view (calendar-kit timeline) ────────────────────────────

function AgendaView({
  date,
  reservations,
  onDateChange,
}: {
  date: Date;
  reservations: any[];
  onDateChange: (d: Date) => void;
}) {
  const theme = useAppTheme();

  // Map reservations → events. Each reservation becomes up to two events:
  //   - check-in at 14:00 on checkInDate
  //   - check-out at 12:00 on checkOutDate
  // Hotels typically operate 14:00/12:00 windows; tweak here if policy changes.
  const events = useMemo<EventItem[]>(() => {
    const out: EventItem[] = [];
    for (const r of reservations) {
      const inDate = new Date(r.checkInDate);
      const outDate = new Date(r.checkOutDate);
      const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : 'Гость';
      const colour = reservationStatusColors[r.status] || semantic.neutral;

      const inStart = new Date(inDate);
      inStart.setHours(14, 0, 0, 0);
      const inEnd = new Date(inStart);
      inEnd.setHours(15, 0, 0, 0);
      out.push({
        id: `${r.id}-in`,
        title: `Заезд · #${r.roomNumber} · ${guestName}`,
        start: { dateTime: inStart.toISOString() },
        end: { dateTime: inEnd.toISOString() },
        color: colour,
      });

      const outStart = new Date(outDate);
      outStart.setHours(12, 0, 0, 0);
      const outEnd = new Date(outStart);
      outEnd.setHours(13, 0, 0, 0);
      out.push({
        id: `${r.id}-out`,
        title: `Выезд · #${r.roomNumber} · ${guestName}`,
        start: { dateTime: outStart.toISOString() },
        end: { dateTime: outEnd.toISOString() },
        color: colour,
      });
    }
    return out;
  }, [reservations]);

  const handleEventPress = useCallback((_: OnEventResponse) => {
    // Future: navigate to reservation detail. Noop for now.
  }, []);

  return (
    <View style={styles.agendaContainer}>
      <CalendarKit
        viewMode="threeDays"
        initialDate={date.toISOString()}
        events={events}
        onPressEvent={handleEventPress}
        onDateChanged={(iso) => onDateChange(new Date(iso))}
        firstDay={1}
        locale="ru"
        theme={{
          colors: {
            primary: theme.colors.primary,
            onPrimary: theme.colors.onPrimary,
            background: theme.colors.background,
            onBackground: theme.colors.onSurface,
            border: theme.colors.outlineVariant,
            text: theme.colors.onSurface,
            surface: theme.colors.surface,
          },
        }}
      />
    </View>
  );
}

// ── Utilities ──────────────────────────────────────────────────────

function computeSpan(
  reservation: any,
  days: Date[],
): { startCol: number; colCount: number } | null {
  const inDate = startOfDay(new Date(reservation.checkInDate));
  const outDate = startOfDay(new Date(reservation.checkOutDate));
  const winStart = startOfDay(days[0]);
  const winEnd = startOfDay(days[days.length - 1]);
  if (outDate <= winStart || inDate > winEnd) return null;
  const startCol = Math.max(0, differenceInCalendarDays(inDate, winStart));
  const endCol = Math.min(days.length, differenceInCalendarDays(outDate, winStart));
  const colCount = Math.max(1, endCol - startCol);
  return { startCol, colCount };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    paddingBottom: spacing.sm,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  toolbarLabel: { flex: 1, textAlign: 'center', fontWeight: '600' },
  headerRow: { flexDirection: 'row' },
  gridRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roomCell: {
    width: ROOM_COL_WIDTH,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  roomNum: { fontWeight: 'bold' },
  roomType: {},
  dayCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: { textTransform: 'uppercase' },
  dayNum: { fontWeight: '600' },
  bar: {
    position: 'absolute',
    top: 6,
    height: ROW_HEIGHT - 12,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  barText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  agendaContainer: {
    flex: 1,
  },
});
