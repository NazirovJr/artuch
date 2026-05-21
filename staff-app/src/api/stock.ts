import { apiFetch } from './client';

export type StockSource = 'warehouse' | 'inventory';
export type LocationKind = 'warehouse' | 'outlet';

export type StockMovementType =
  | 'receipt'
  | 'issue'
  | 'sale'
  | 'transfer_out'
  | 'transfer_in'
  | 'return_customer'
  | 'return_supplier'
  | 'adjustment'
  | 'stocktake'
  | 'rental_out'
  | 'rental_in'
  | 'writeoff';

export interface StockLevel {
  id: string;
  source: StockSource;
  itemId: string;
  locationId: string;
  locationKind: LocationKind;
  quantity: number;
  reservedQuantity: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  movementNumber: number;
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  locationKind: LocationKind;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  reservedAfter: number | null;
  performedBy: string;
  performedByName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  counterparty: string | null;
  unitCost: number | null;
  totalCost: number | null;
  createdAt: string;
}

export function getStockLevelsByLocation(
  locationId: string,
  source?: StockSource,
): Promise<StockLevel[]> {
  const params = new URLSearchParams({ locationId });
  if (source) params.set('source', source);
  return apiFetch<StockLevel[]>(`/stock/levels?${params.toString()}`);
}

export function getStockLevelsByItem(
  itemId: string,
  source?: StockSource,
): Promise<StockLevel[]> {
  const params = new URLSearchParams({ itemId });
  if (source) params.set('source', source);
  return apiFetch<StockLevel[]>(`/stock/levels?${params.toString()}`);
}

export interface MovementFilters {
  source?: StockSource;
  itemId?: string;
  locationId?: string;
  type?: StockMovementType;
  referenceType?: string;
  referenceId?: string;
  limit?: number;
}

export function getStockMovements(
  filters: MovementFilters = {},
): Promise<StockMovement[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<StockMovement[]>(`/stock/movements${q}`);
}
