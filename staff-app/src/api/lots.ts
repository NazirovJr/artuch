import { apiFetch } from './client';
import type { LocationKind, StockSource } from './stock';

export interface StockLot {
  id: string;
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  locationKind: LocationKind;
  lotCode: string | null;
  receivedAt: string;
  expiresAt: string | null;
  originalQuantity: number;
  remainingQuantity: number;
  unitCost: number | null;
  supplierName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getActiveLots(filters: {
  source?: StockSource;
  itemId?: string;
  locationId?: string;
}): Promise<StockLot[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<StockLot[]>(`/stock/lots${q}`);
}

export function getExpiringLots(
  days = 14,
  includeExpired = false,
): Promise<StockLot[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (includeExpired) params.set('includeExpired', 'true');
  return apiFetch<StockLot[]>(`/stock/lots/expiring?${params.toString()}`);
}

// ─── Unit conversions ───────────────────────────────────────────

export interface UnitConversion {
  id: string;
  source: StockSource;
  itemId: string;
  fromUnit: string;
  factor: number;
  notes: string | null;
}

export function getUnitConversions(
  source: StockSource,
  itemId: string,
): Promise<UnitConversion[]> {
  return apiFetch<UnitConversion[]>(
    `/stock/unit-conversions?source=${source}&itemId=${itemId}`,
  );
}

export function upsertUnitConversion(data: {
  source: StockSource;
  itemId: string;
  fromUnit: string;
  factor: number;
  notes?: string;
}): Promise<UnitConversion> {
  return apiFetch<UnitConversion>('/stock/unit-conversions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteUnitConversion(id: string): Promise<void> {
  return apiFetch<void>(`/stock/unit-conversions/${id}`, { method: 'DELETE' });
}
