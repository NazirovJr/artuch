import { apiFetch } from './client';
import type { StockSource } from './stock';

export interface COGSReport {
  totalQuantity: number;
  totalCost: number;
  byType: Record<string, { quantity: number; cost: number }>;
}

export interface ValuationRow {
  source: StockSource;
  itemId: string;
  itemName: string;
  locationId: string;
  totalQuantity: number;
  totalValue: number;
  averageUnitCost: number;
}

export function getCOGS(filters: {
  source?: StockSource;
  itemId?: string;
  locationId?: string;
  from?: string;
  to?: string;
}): Promise<COGSReport> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<COGSReport>(`/stock/costing/cogs${q}`);
}

export function getValuation(filters: {
  source?: StockSource;
  locationId?: string;
}): Promise<ValuationRow[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<ValuationRow[]>(`/stock/costing/valuation${q}`);
}
