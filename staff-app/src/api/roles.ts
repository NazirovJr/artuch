import { apiFetch } from './client';

export function getRoles() {
  return apiFetch<any[]>('/roles');
}
