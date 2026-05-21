/**
 * Role → bento blocks mapping for HomeScreen.
 *
 * Why a pure data module: keeps the screen component thin (just renders
 * what it gets), and lets us unit-test "owner sees revenue, cleaner sees
 * task count" without rendering React.
 *
 * Adding a new role:
 *   1. Add a case to `getBlocksFor()`
 *   2. Compose sections from helper builders below
 *   3. Each block's `target` points to a drawer route (and optional inner
 *      screen) — see `MainDrawer` for available drawer keys
 */
import type { BentoSize, BentoTone } from '../../components/bento/BentoCard';

export interface Kpi {
  todayRevenue: number;
  activeOrders: number;
  occupiedRooms: number;
  totalRooms: number;
  pendingReservations: number;
}

export interface BlockTarget {
  /** Drawer key (e.g. 'POSDrawer', 'KitchenDrawer') */
  drawer: string;
  /** Optional nested screen name inside the stack */
  screen?: string;
}

export interface BlockSpec {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: string;
  size?: BentoSize;
  tone?: BentoTone;
  target?: BlockTarget;
}

export interface BlockSection {
  title?: string;
  subtitle?: string;
  blocks: BlockSpec[];
}

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} TJS`;

// ── Block builders (composed by role) ──────────────────────────────

const revenueBlock = (kpi: Kpi | null): BlockSpec => ({
  title: 'Выручка сегодня',
  value: kpi ? fmtMoney(kpi.todayRevenue) : '—',
  subtitle: 'Все смены, без возвратов',
  icon: 'cash-multiple',
  size: 'wide',
  tone: 'primary',
  target: { drawer: 'AdminDrawer', screen: 'Revenue' },
});

const activeOrdersBlock = (kpi: Kpi | null): BlockSpec => ({
  title: 'Активные заказы',
  value: kpi?.activeOrders ?? '—',
  subtitle: 'В работе или ожидании',
  icon: 'food-fork-drink',
  size: 'sm',
  tone: 'tonal',
  target: { drawer: 'OrdersDrawer' },
});

const occupancyBlock = (kpi: Kpi | null): BlockSpec => ({
  title: 'Загрузка номеров',
  value: kpi ? `${kpi.occupiedRooms}/${kpi.totalRooms}` : '—',
  subtitle: kpi && kpi.totalRooms > 0
    ? `${Math.round((kpi.occupiedRooms / kpi.totalRooms) * 100)}% занято`
    : 'Нет данных',
  icon: 'bed',
  size: 'sm',
  tone: 'tonal',
  target: { drawer: 'RoomsDrawer' },
});

const reservationsBlock = (kpi: Kpi | null): BlockSpec => ({
  title: 'Брони ожидают',
  value: kpi?.pendingReservations ?? '—',
  subtitle: 'Подтверждение / заезд',
  icon: 'calendar-check',
  size: 'sm',
  tone: 'accent',
  target: { drawer: 'RoomsDrawer', screen: 'ReservationList' },
});

const shortcut = (
  title: string,
  icon: string,
  drawer: string,
  screen?: string,
  size: BentoSize = 'sm',
): BlockSpec => ({ title, icon, size, tone: 'neutral', target: { drawer, screen } });

// ── Per-role compositions ──────────────────────────────────────────

export function getBlocksFor(role: string, kpi: Kpi | null): BlockSection[] {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'manager':
      return [
        {
          title: 'Сводка по объекту',
          blocks: [
            revenueBlock(kpi),
            activeOrdersBlock(kpi),
            occupancyBlock(kpi),
            reservationsBlock(kpi),
          ],
        },
        {
          title: 'Быстрый доступ',
          blocks: [
            shortcut('Аналитика', 'chart-line', 'AdminDrawer', 'Dashboard', 'md'),
            shortcut('Сотрудники', 'account-group', 'AdminDrawer', 'StaffList', 'md'),
            shortcut('Типы комнат', 'bed', 'AdminDrawer', 'RoomTypeList', 'md'),
            shortcut('Комнаты', 'door', 'AdminDrawer', 'RoomManagement', 'md'),
            shortcut('Аудит', 'clipboard-list', 'AdminDrawer', 'AuditLog'),
            shortcut('Исключения', 'alert-octagon', 'AdminDrawer', 'Exceptions'),
          ],
        },
      ];

    case 'cashier':
    case 'barman':
      return [
        {
          title: 'Касса',
          blocks: [
            shortcut('Открыть смену', 'cash-register', 'POSDrawer', 'ShiftOpen', 'wide'),
            shortcut('Продажа', 'point-of-sale', 'POSDrawer', 'POS', 'md'),
            shortcut('История', 'receipt', 'POSDrawer', 'TransactionHistory', 'md'),
            shortcut('Возврат', 'cash-refund', 'POSDrawer', 'Refund'),
          ],
        },
      ];

    case 'waiter':
      return [
        {
          title: 'Зал',
          blocks: [
            { ...activeOrdersBlock(kpi), size: 'wide', tone: 'primary' },
            shortcut('Новый заказ', 'plus-box', 'OrdersDrawer', 'NewOrder', 'md'),
            shortcut('Все заказы', 'format-list-bulleted', 'OrdersDrawer', 'OrderList', 'md'),
          ],
        },
      ];

    case 'cook':
      return [
        {
          title: 'Кухня',
          blocks: [
            { ...activeOrdersBlock(kpi), size: 'wide', tone: 'primary' },
            shortcut('Открыть кухню', 'pot-steam', 'KitchenDrawer', undefined, 'wide'),
          ],
        },
      ];

    case 'reception':
      return [
        {
          title: 'Ресепшн',
          blocks: [
            occupancyBlock(kpi),
            reservationsBlock(kpi),
            shortcut('Карта номеров', 'view-grid', 'RoomsDrawer', 'RoomGrid', 'wide'),
            shortcut('Заезд', 'login', 'RoomsDrawer', 'CheckIn', 'md'),
            shortcut('Гости', 'account-multiple', 'RoomsDrawer', 'GuestList', 'md'),
            shortcut('Календарь', 'calendar-month', 'RoomsDrawer', 'ReservationCalendar', 'wide'),
          ],
        },
      ];

    case 'cleaning':
      return [
        {
          title: 'Уборка',
          blocks: [
            shortcut('Мои задачи', 'broom', 'CleaningDrawer', 'CleaningList', 'wide'),
          ],
        },
      ];

    case 'warehouse-keeper':
      return [
        {
          title: 'Склад',
          blocks: [
            shortcut('Остатки', 'warehouse', 'WarehouseDrawer', 'WarehouseList', 'wide'),
            shortcut('Аренды', 'package-variant', 'WarehouseDrawer', 'RentalList', 'md'),
            shortcut('Новая аренда', 'plus-circle', 'WarehouseDrawer', 'NewRental', 'md'),
          ],
        },
      ];

    default:
      return [
        {
          title: 'Доступные разделы',
          subtitle: 'Откройте меню слева, чтобы увидеть полный список',
          blocks: [],
        },
      ];
  }
}
