import { apiFetch } from './client';

export type TransferStatus = 'in_transit' | 'received' | 'cancelled';

export interface StockTransfer {
  id: string;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  sourceItemId: string;
  targetItemId: string | null;
  quantity: number;
  receivedQuantity: number | null;
  status: TransferStatus;
  notes: string | null;
  createdBy: string;
  receivedBy: string | null;
  cancelledBy: string | null;
  createdAt: string;
  receivedAt: string | null;
  cancelledAt: string | null;
  sourceWarehouse?: { id: string; name: string };
  targetWarehouse?: { id: string; name: string };
  sourceItem?: { id: string; name: string; unit: string };
}

export interface CreateTransferData {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  sourceItemId: string;
  quantity: number;
  createdBy: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ReceiveTransferData {
  receivedBy: string;
  receivedQuantity?: number;
  notes?: string;
}

export interface CancelTransferData {
  cancelledBy: string;
  notes?: string;
}

export function getTransfers(status?: TransferStatus): Promise<StockTransfer[]> {
  const q = status ? `?status=${status}` : '';
  return apiFetch<StockTransfer[]>(`/warehouse/transfers${q}`);
}

export function getTransfer(id: string): Promise<StockTransfer> {
  return apiFetch<StockTransfer>(`/warehouse/transfers/${id}`);
}

export function createTransfer(
  data: CreateTransferData,
): Promise<StockTransfer> {
  return apiFetch<StockTransfer>('/warehouse/transfers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function receiveTransfer(
  id: string,
  data: ReceiveTransferData,
): Promise<StockTransfer> {
  return apiFetch<StockTransfer>(`/warehouse/transfers/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function cancelTransfer(
  id: string,
  data: CancelTransferData,
): Promise<StockTransfer> {
  return apiFetch<StockTransfer>(`/warehouse/transfers/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
