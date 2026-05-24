import { apiFetch } from './client';

export type Station = 'kitchen' | 'bar';

export interface KdsItem {
  id: string;
  menuItemName: string;
  quantity: number;
  notes?: string | null;
  status: string; // 'sent' | 'preparing' | 'ready'
  firedAt?: string | null;
}

export interface KdsTicket {
  orderId: string;
  orderNumber: number;
  roundNumber: number;
  tableNumber: string;
  checkId: string;
  createdAt: string;
  items: KdsItem[];
}

/** Active queue for a prep station — tickets (rounds) with their station items. */
export function getKdsQueue(station: Station) {
  return apiFetch<KdsTicket[]>(`/v2/kds?station=${station}`);
}

/** Advance one line item: sent → preparing → ready → served. */
export function updateKdsItemStatus(itemId: string, status: string) {
  return apiFetch<any>(`/v2/kds/items/${itemId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
