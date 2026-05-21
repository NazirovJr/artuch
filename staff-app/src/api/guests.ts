import { apiFetch } from './client';

export function getGuests() {
  return apiFetch<any[]>('/v2/guests');
}

export function getGuest(id: string) {
  return apiFetch<any>(`/v2/guests/${id}`);
}

export function createGuest(data: any) {
  return apiFetch<any>('/v2/guests', { method: 'POST', body: JSON.stringify(data) });
}
