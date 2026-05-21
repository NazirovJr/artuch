import { apiFetch } from './client';

export interface Outlet {
  id: string;
  name: string;
  type: string;
  warehouseId: string | null;
  supportsFolio: boolean;
  supportsRental: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutletData {
  name: string;
  type: string;
  warehouseId?: string;
  supportsFolio?: boolean;
  supportsRental?: boolean;
}

export interface UpdateOutletData {
  name?: string;
  type?: string;
  warehouseId?: string;
  supportsFolio?: boolean;
  supportsRental?: boolean;
  isActive?: boolean;
}

export async function getOutlets(): Promise<Outlet[]> {
  return apiFetch<Outlet[]>('/outlets');
}

export async function getOutlet(id: string): Promise<Outlet> {
  return apiFetch<Outlet>(`/outlets/${id}`);
}

export async function createOutlet(data: CreateOutletData): Promise<Outlet> {
  return apiFetch<Outlet>('/outlets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOutlet(id: string, data: UpdateOutletData): Promise<Outlet> {
  return apiFetch<Outlet>(`/outlets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteOutlet(id: string): Promise<void> {
  await apiFetch(`/outlets/${id}`, { method: 'DELETE' });
}

export async function assignUserToOutlet(outletId: string, userId: string): Promise<void> {
  await apiFetch(`/outlets/${outletId}/users/${userId}`, { method: 'POST' });
}

export async function unassignUserFromOutlet(outletId: string, userId: string): Promise<void> {
  await apiFetch(`/outlets/${outletId}/users/${userId}`, { method: 'DELETE' });
}

export async function getOutletUsers(outletId: string): Promise<any[]> {
  return apiFetch<any[]>(`/outlets/${outletId}/users`);
}
