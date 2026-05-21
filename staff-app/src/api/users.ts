import { apiFetch } from './client';

export interface UserWriteData {
  username?: string;
  password?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  /** Role name — e.g. 'waiter'. Source of truth for CASL on the backend. */
  role?: string;
  /** Role UUID — sent alongside `role` so the users table stays consistent. */
  roleId?: string;
  /** 4-6 digit PIN. Empty string = "don't change". */
  pin?: string;
  isActive?: boolean;
  /** Outlet UUIDs the user is assigned to. Empty array clears all. */
  outletIds?: string[];
}

export function getUsers(includeInactive = false) {
  const q = includeInactive ? '?includeInactive=true' : '';
  return apiFetch<any[]>(`/users${q}`);
}

export function getUser(id: string) {
  return apiFetch<any>(`/users/${id}`);
}

export function createUser(data: UserWriteData) {
  return apiFetch<any>('/users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateUser(id: string, data: UserWriteData) {
  return apiFetch<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteUser(id: string) {
  return apiFetch<void>(`/users/${id}`, { method: 'DELETE' });
}
