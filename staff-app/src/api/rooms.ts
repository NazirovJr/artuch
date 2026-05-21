import { apiFetch } from './client';

export function getRooms() {
  return apiFetch<any[]>('/v2/rooms');
}

export function updateRoom(number: number, data: any) {
  return apiFetch<any>(`/v2/rooms/${number}`, { method: 'PATCH', body: JSON.stringify(data) });
}
