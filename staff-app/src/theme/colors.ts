/** Centralized semantic color tokens — single source of truth for all status colors */

export const semantic = {
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  muted: '#6B7280',
  neutral: '#9CA3AF',
} as const;

export const orderStatusColors: Record<string, string> = {
  pending: semantic.warning,
  preparing: semantic.info,
  ready: semantic.success,
  completed: semantic.muted,
};

export const orderStatusLabels: Record<string, string> = {
  pending: 'Ожидает',
  preparing: 'Готовится',
  ready: 'Готов',
  completed: 'Завершён',
};

export const roomStatusColors: Record<string, string> = {
  available: '#22C55E',
  occupied: '#EF4444',
  maintenance: '#EAB308',
  'needs-cleaning': semantic.neutral,
};

export const roomStatusLabels: Record<string, string> = {
  available: 'Свободен',
  occupied: 'Занят',
  maintenance: 'Обслуживание',
  'needs-cleaning': 'Требует уборки',
};

export const cleaningStatusColors: Record<string, string> = {
  'needs-cleaning': '#EF4444',
  cleaning: semantic.warning,
  clean: semantic.success,
  pending: semantic.neutral,
};

export const cleaningStatusLabels: Record<string, string> = {
  'needs-cleaning': 'Требует уборки',
  cleaning: 'Убирается',
  clean: 'Чисто',
  pending: 'Ожидает',
};

/**
 * Soft tonal backgrounds for cleaning-status pills (light bg + dark text).
 * Distinct from `cleaningStatusColors` (saturated, used for borders/dots).
 */
export const cleaningBadgeColors: Record<string, { background: string; text: string }> = {
  clean: { background: '#D1FAE5', text: '#065F46' },
  cleaning: { background: '#FEF3C7', text: '#78350F' },
  'in-progress': { background: '#FEF3C7', text: '#78350F' },
  'needs-cleaning': { background: '#FEE2E2', text: '#7F1D1D' },
  pending: { background: '#F3F4F6', text: '#374151' },
};

export const cleaningNextStatus: Record<string, string> = {
  'needs-cleaning': 'cleaning',
  cleaning: 'clean',
  clean: 'needs-cleaning',
  pending: 'needs-cleaning',
};

export const reservationStatusColors: Record<string, string> = {
  pending: semantic.warning,
  confirmed: semantic.warning,
  'checked-in': semantic.success,
  'checked-out': semantic.neutral,
  cancelled: semantic.error,
};

export const reservationStatusLabels: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждено',
  'checked-in': 'Заселён',
  'checked-out': 'Выселен',
  cancelled: 'Отменено',
};

export const folioStatusColors: Record<string, string> = {
  open: semantic.success,
  closed: semantic.neutral,
};

export const folioStatusLabels: Record<string, string> = {
  open: 'Открыт',
  closed: 'Закрыт',
};

export const rentalStatusColors: Record<string, string> = {
  active: semantic.success,
  overdue: semantic.error,
  returned: semantic.muted,
  damaged: semantic.warning,
};

export const rentalStatusLabels: Record<string, string> = {
  active: 'Активная',
  overdue: 'Просрочена',
  returned: 'Возвращена',
  damaged: 'Повреждена',
};

export const transactionStatusColors: Record<string, string> = {
  completed: semantic.success,
  refunded: semantic.error,
  'partially-refunded': semantic.warning,
};

export const transactionStatusLabels: Record<string, string> = {
  completed: 'Завершено',
  refunded: 'Возврат',
  'partially-refunded': 'Частичный возврат',
};

export const roleColors: Record<string, string> = {
  owner: '#7C3AED',
  admin: '#3B82F6',
  manager: '#6366F1',
  waiter: '#10B981',
  cook: '#F59E0B',
  reception: '#EC4899',
  cleaning: '#14B8A6',
  'warehouse-keeper': '#8B5CF6',
  cashier: '#F97316',
  barman: '#06B6D4',
};

/** All status color maps indexed by domain */
export const statusColorsByDomain: Record<string, Record<string, string>> = {
  order: orderStatusColors,
  room: roomStatusColors,
  cleaning: cleaningStatusColors,
  reservation: reservationStatusColors,
  folio: folioStatusColors,
  rental: rentalStatusColors,
  transaction: transactionStatusColors,
  role: roleColors,
};

export const statusLabelsByDomain: Record<string, Record<string, string>> = {
  order: orderStatusLabels,
  room: roomStatusLabels,
  cleaning: cleaningStatusLabels,
  reservation: reservationStatusLabels,
  folio: folioStatusLabels,
  rental: rentalStatusLabels,
  transaction: transactionStatusLabels,
};
