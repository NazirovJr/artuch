import { ApiError, apiFetch } from './client';

export interface WarehouseItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  barcode: string | null;
  quantity: number;
  minQuantity: number;
  parLevel: number;
  reorderPoint: number;
  price: number;
  warehouseId: string | null;
  lastUpdated: string;
}

export interface CreateWarehouseItemData {
  name: string;
  category: string;
  unit: string;
  barcode?: string;
  quantity?: number;
  minQuantity?: number;
  parLevel?: number;
  reorderPoint?: number;
  price: number;
  warehouseId?: string;
}

export type UpdateWarehouseItemData = Partial<CreateWarehouseItemData>;

export type WarehouseTransactionType =
  | 'income'
  | 'expense'
  | 'sale'
  | 'transfer'
  | 'return'
  | 'return_customer'
  | 'return_supplier'
  | 'adjustment'
  | 'writeoff';

export interface WarehouseTransaction {
  id: string;
  transactionNumber: number;
  type: WarehouseTransactionType;
  itemId: string;
  item?: WarehouseItem;
  quantity: number;
  balanceAfter: number | null;
  performedBy: string;
  notes: string | null;
  supplier: string | null;
  recipient: string | null;
  totalCost: number | null;
  sourceWarehouseId: string | null;
  targetWarehouseId: string | null;
  createdAt: string;
}

export interface CreateTransactionData {
  type: WarehouseTransactionType;
  itemId: string;
  quantity: number;
  performedBy: string;
  notes?: string;
  supplier?: string;
  // FK to suppliers directory; takes precedence over `supplier` text.
  supplierId?: string;
  recipient?: string;
  totalCost?: number;
  sourceWarehouseId?: string;
  targetWarehouseId?: string;
  idempotencyKey?: string;
  // P2.1 — lot tracking (optional, only meaningful on income/return)
  lotCode?: string;
  expiresAt?: string; // ISO date
  unitCost?: number;
  // P2.2 — unit conversion (optional, defaults to canonical)
  inputUnit?: string;
}

export function getWarehouseItems(): Promise<WarehouseItem[]> {
  return apiFetch<WarehouseItem[]>('/warehouse');
}

/**
 * DISTINCT category labels currently in use across the catalogue. Powers
 * the autocomplete on the "new item" form so staff naturally reuse
 * existing labels and only invent new ones when needed.
 */
export function getWarehouseCategories(): Promise<string[]> {
  return apiFetch<string[]>('/warehouse/categories');
}

/**
 * Create a new warehouse SKU. When `quantity` > 0 the server records an
 * opening-balance receipt movement so the audit log shows where the
 * starting count came from.
 */
export function createWarehouseItem(
  data: CreateWarehouseItemData,
): Promise<WarehouseItem> {
  return apiFetch<WarehouseItem>('/warehouse', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Lookup a warehouse item by its barcode — designed for the scan-to-prefill
 * workflow. Server returns 404 if the barcode isn't found; this wrapper
 * resolves to null for that case so callers can branch easily.
 */
export async function lookupItemByBarcode(
  barcode: string,
  warehouseId?: string,
): Promise<WarehouseItem | null> {
  const params = new URLSearchParams({ barcode });
  if (warehouseId) params.set('warehouseId', warehouseId);
  try {
    return await apiFetch<WarehouseItem>(
      `/warehouse/lookup?${params.toString()}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function getWarehouseTransactions(): Promise<WarehouseTransaction[]> {
  return apiFetch<WarehouseTransaction[]>('/warehouse/transactions');
}

export function createWarehouseTransaction(
  data: CreateTransactionData,
): Promise<WarehouseTransaction> {
  return apiFetch<WarehouseTransaction>('/warehouse/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
