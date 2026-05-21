import { apiFetch } from './client';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierData {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type UpdateSupplierData = Partial<CreateSupplierData> & {
  isActive?: boolean;
};

export function getSuppliers(includeInactive = false): Promise<Supplier[]> {
  const q = includeInactive ? '?includeInactive=true' : '';
  return apiFetch<Supplier[]>(`/suppliers${q}`);
}

export function getSupplier(id: string): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/${id}`);
}

export function createSupplier(data: CreateSupplierData): Promise<Supplier> {
  return apiFetch<Supplier>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSupplier(
  id: string,
  data: UpdateSupplierData,
): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/suppliers/${id}`, { method: 'DELETE' });
}
