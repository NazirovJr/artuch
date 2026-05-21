import { apiFetch } from './client';

export function getRevenue(period?: string) {
  const query = period ? `?period=${period}` : '';
  return apiFetch<any[]>(`/v2/analytics/revenue${query}`);
}

export function getTopItems(limit?: number) {
  const query = limit ? `?limit=${limit}` : '';
  return apiFetch<any[]>(`/v2/analytics/top-items${query}`);
}

export function getEmployeeStats() {
  return apiFetch<any[]>('/v2/analytics/employee-stats');
}

export function getRoomOccupancy() {
  return apiFetch<any>('/v2/analytics/room-occupancy');
}

export function getKpi() {
  return apiFetch<any>('/v2/analytics/kpi');
}
