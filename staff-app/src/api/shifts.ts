import { apiFetch } from './client';

export interface Shift {
  id: string;
  userId: string;
  userName?: string | null;
  outletId?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingCash: string | number;
  expectedCash?: string | number | null;
  actualCash?: string | number | null;
  variance?: string | number | null;
  status: 'open' | 'closed' | 'reconciled';
  closeApprovedBy?: string | null;
  notes?: string | null;
}

export function getActiveShift() {
  return apiFetch<Shift | null>('/v2/shifts/active');
}

export function openShift(data: { openingCash?: number; outletId?: string }) {
  return apiFetch<Shift>('/v2/shifts/open', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function closeShift(
  id: string,
  data: { actualCash: number; managerPin?: string; notes?: string },
) {
  return apiFetch<Shift>(`/v2/shifts/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listShifts(params: {
  userId?: string;
  from?: string;
  to?: string;
  status?: string;
} = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null) as [string, string][],
  ).toString();
  return apiFetch<Shift[]>(`/v2/shifts${query ? `?${query}` : ''}`);
}
