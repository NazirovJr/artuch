import { apiFetch } from './client';

export interface CheckItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes?: string | null;
  station: string; // 'kitchen' | 'bar' | 'none'
  status: string; // 'new' | 'sent' | 'preparing' | 'ready' | 'served' | 'cancelled'
}

export interface CheckRound {
  id: string;
  orderNumber: number;
  roundNumber: number;
  waiterName?: string | null;
  status: string;
  total: number;
  createdAt: string;
  items: CheckItem[];
}

export interface TableCheck {
  id: string;
  checkNumber: number;
  tableNumber: string;
  status: string; // 'open' | 'closed' | 'cancelled'
  guestId?: string | null;
  folioId?: string | null;
  openedByName?: string | null;
  guestCount?: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod?: string | null;
  paidAmount: number;
  openedAt: string;
  closedAt?: string | null;
  orders: CheckRound[];
}

export interface RoundItemPayload {
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes?: string | null;
}

/** Open table checks (the list of "active tables"). */
export function getOpenChecks() {
  return apiFetch<TableCheck[]>('/v2/checks');
}

export function getCheck(id: string) {
  return apiFetch<TableCheck>(`/v2/checks/${id}`);
}

/** Open a check for a table. Idempotent per table on the server. */
export function openCheck(body: {
  tableNumber: string;
  openedByName?: string;
  guestId?: string;
  guestCount?: number;
}) {
  return apiFetch<TableCheck>('/v2/checks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Append a round (one "send") to a check; server routes items by station. */
export function addRound(
  checkId: string,
  body: { items: RoundItemPayload[]; waiterName?: string },
) {
  return apiFetch<CheckRound>(`/v2/checks/${checkId}/rounds`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function settleCheck(
  checkId: string,
  body: { method: 'cash' | 'card' | 'folio'; folioId?: string; outletId?: string },
) {
  return apiFetch<TableCheck>(`/v2/checks/${checkId}/settle`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function cancelCheck(checkId: string, managerPin: string, reason?: string) {
  return apiFetch<TableCheck>(`/v2/checks/${checkId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ managerPin, reason }),
  });
}
