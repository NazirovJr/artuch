import { apiFetch } from './client';

export function getRentals(status?: string) {
  const query = status ? `?status=${status}` : '';
  return apiFetch<any[]>(`/rentals${query}`);
}

export function getRental(id: string) {
  return apiFetch<any>(`/rentals/${id}`);
}

export function createRental(data: any) {
  return apiFetch<any>('/rentals', { method: 'POST', body: JSON.stringify(data) });
}

export function returnRental(id: string, data: any) {
  return apiFetch<any>(`/rentals/${id}/return`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function extendRental(id: string, data: { newDate: string }) {
  return apiFetch<any>(`/rentals/${id}/extend`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function getOverdueRentals() {
  return apiFetch<any[]>('/rentals/overdue');
}
