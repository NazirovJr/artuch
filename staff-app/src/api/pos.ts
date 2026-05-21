import { apiFetch } from './client';

export function getTransactions(type?: string) {
  const query = type ? `?type=${type}` : '';
  return apiFetch<any[]>(`/v2/pos/transactions${query}`);
}

export function createTransaction(data: any) {
  return apiFetch<any>('/v2/pos/transactions', { method: 'POST', body: JSON.stringify(data) });
}

export function getRefunds() {
  return apiFetch<any[]>('/v2/pos/refunds');
}

export function createRefund(data: any) {
  return apiFetch<any>('/v2/pos/refunds', { method: 'POST', body: JSON.stringify(data) });
}
