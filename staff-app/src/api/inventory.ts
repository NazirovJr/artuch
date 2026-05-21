import { apiFetch } from './client';

export function getInventory(category?: string) {
  const query = category ? `?category=${category}` : '';
  return apiFetch<any[]>(`/inventory${query}`);
}
