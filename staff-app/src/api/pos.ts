import { apiFetch } from './client';

export interface PosLineItem {
  itemId?: string;
  name: string;
  price: number;
  quantity: number;
  volume?: number | null;
}

export interface CreateTransactionInput {
  type: string;
  employeeId: string;
  employee?: string;
  total: number;
  paymentMethod: string;
  outletId?: string | null;
  folioId?: string | null;
  shiftId?: string;
  idempotencyKey?: string;
  items: PosLineItem[];
}

export interface CreateRefundInput {
  transactionId: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  amount: number;
  reason: string;
  employeeId: string;
  employeeName: string;
  folioId?: string;
  idempotencyKey?: string;
  /** Manager override PIN — required by the backend RequireManagerPin guard. */
  managerPin?: string;
}

export function getTransactions(type?: string) {
  const query = type ? `?type=${type}` : '';
  return apiFetch<any[]>(`/v2/pos/transactions${query}`);
}

export function createTransaction(data: CreateTransactionInput) {
  return apiFetch<any>('/v2/pos/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getRefunds() {
  return apiFetch<any[]>('/v2/pos/refunds');
}

export function createRefund(data: CreateRefundInput) {
  return apiFetch<any>('/v2/pos/refunds', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
