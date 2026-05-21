import { apiFetch } from './client';

export function getOrders(status?: string) {
  const query = status ? `?status=${status}` : '';
  return apiFetch<any[]>(`/v2/orders${query}`);
}

export function createOrder(data: any) {
  return apiFetch<any>('/v2/orders', { method: 'POST', body: JSON.stringify(data) });
}

export function updateOrderStatus(id: string, status: string) {
  return apiFetch<any>(`/v2/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function getOrder(id: string) {
  return apiFetch<any>(`/v2/orders/${id}`);
}

export interface OrderItemPayload {
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  notes?: string;
}

export function updateOrderItems(
  id: string,
  payload: { items: OrderItemPayload[]; reason?: string; managerPin?: string },
) {
  return apiFetch<any>(`/v2/orders/${id}/items`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getOrderEditLogs(id: string) {
  return apiFetch<any[]>(`/v2/orders/${id}/edit-logs`);
}
