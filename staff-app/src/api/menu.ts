import { apiFetch } from './client';

export function getMenu() {
  return apiFetch<any[]>('/v2/menu');
}
