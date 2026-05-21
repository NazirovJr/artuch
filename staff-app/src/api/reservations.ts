import { apiFetch } from './client';

export function getReservations() {
  return apiFetch<any[]>('/v2/reservations');
}

export function createReservation(data: any) {
  return apiFetch<any>('/v2/reservations', { method: 'POST', body: JSON.stringify(data) });
}

export function updateReservation(id: string, data: any) {
  return apiFetch<any>(`/v2/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function getReservationsCalendar(params: {
  from: string;
  to: string;
  roomNumber?: number;
}) {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.roomNumber != null) qs.set('roomNumber', String(params.roomNumber));
  return apiFetch<any[]>(`/v2/reservations/calendar?${qs.toString()}`);
}

export function checkReservationConflicts(params: {
  roomNumber: number;
  from: string;
  to: string;
  excludeId?: string;
}) {
  const qs = new URLSearchParams({
    roomNumber: String(params.roomNumber),
    from: params.from,
    to: params.to,
  });
  if (params.excludeId) qs.set('excludeId', params.excludeId);
  return apiFetch<any[]>(`/v2/reservations/conflicts?${qs.toString()}`);
}
