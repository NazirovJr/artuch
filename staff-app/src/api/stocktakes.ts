import { apiFetch } from './client';

export type StocktakeStatus =
  | 'in_progress'
  | 'awaiting_approval'
  | 'approved'
  | 'cancelled';

export type VarianceReason =
  | 'spoilage'
  | 'theft'
  | 'count_error'
  | 'damage'
  | 'other';

export interface StocktakeLine {
  id: string;
  stocktakeId: string;
  itemId: string;
  itemName: string;
  unit: string;
  expected: number;
  actual: number | null;
  variance: number | null;
  varianceReason: VarianceReason | null;
  note: string | null;
  updatedAt: string;
  item?: { id: string; name: string; unit: string };
}

export interface Stocktake {
  id: string;
  warehouseId: string;
  status: StocktakeStatus;
  kind: 'cycle' | 'full';
  category: string | null;
  notes: string | null;
  countedBy: string;
  approvedBy: string | null;
  cancelledBy: string | null;
  createdAt: string;
  approvedAt: string | null;
  cancelledAt: string | null;
  warehouse?: { id: string; name: string };
  lines?: StocktakeLine[];
}

export interface CreateStocktakeData {
  warehouseId: string;
  countedBy: string;
  kind?: 'cycle' | 'full';
  category?: string;
  notes?: string;
  itemIds?: string[];
}

export interface RecordCountData {
  actual: number;
  varianceReason?: VarianceReason;
  note?: string;
}

export function getStocktakes(
  warehouseId?: string,
  status?: StocktakeStatus,
): Promise<Stocktake[]> {
  const params = new URLSearchParams();
  if (warehouseId) params.set('warehouseId', warehouseId);
  if (status) params.set('status', status);
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<Stocktake[]>(`/stocktakes${q}`);
}

export function getStocktake(id: string): Promise<Stocktake> {
  return apiFetch<Stocktake>(`/stocktakes/${id}`);
}

export function createStocktake(
  data: CreateStocktakeData,
): Promise<Stocktake> {
  return apiFetch<Stocktake>('/stocktakes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function recordCount(
  stocktakeId: string,
  lineId: string,
  data: RecordCountData,
): Promise<StocktakeLine> {
  return apiFetch<StocktakeLine>(
    `/stocktakes/${stocktakeId}/lines/${lineId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

export function submitStocktake(id: string): Promise<Stocktake> {
  return apiFetch<Stocktake>(`/stocktakes/${id}/submit`, { method: 'POST' });
}

export function approveStocktake(
  id: string,
  approvedBy: string,
  notes?: string,
): Promise<Stocktake> {
  return apiFetch<Stocktake>(`/stocktakes/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy, notes }),
  });
}

export function cancelStocktake(
  id: string,
  cancelledBy: string,
  notes?: string,
): Promise<Stocktake> {
  return apiFetch<Stocktake>(`/stocktakes/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancelledBy, notes }),
  });
}
