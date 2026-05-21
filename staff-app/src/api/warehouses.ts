import { apiFetch } from './client';

export interface Warehouse {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseData {
  name: string;
  type: string;
  description?: string;
}

export interface UpdateWarehouseData {
  name?: string;
  type?: string;
  description?: string;
  isActive?: boolean;
}

export async function getWarehouses(): Promise<Warehouse[]> {
  return apiFetch<Warehouse[]>('/warehouses');
}

export async function getWarehouseById(id: string): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/warehouses/${id}`);
}

export async function createWarehouse(data: CreateWarehouseData): Promise<Warehouse> {
  return apiFetch<Warehouse>('/warehouses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWarehouse(id: string, data: UpdateWarehouseData): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/warehouses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteWarehouse(id: string): Promise<void> {
  return apiFetch<void>(`/warehouses/${id}`, {
    method: 'DELETE',
  });
}
