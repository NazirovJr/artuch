import { apiFetch } from './client';

export interface MenuItemData {
  id?: string;
  name: string;
  nameRu: string;
  nameTj?: string;
  category: string;
  station: string; // 'kitchen' | 'bar' | 'none'
  price: number;
  description?: string;
  isActive?: boolean;
}

/** Active menu (what waiters order from). */
export function getMenu() {
  return apiFetch<any[]>('/v2/menu');
}

/** Admin list — includes inactive items. */
export function getMenuAdmin() {
  return apiFetch<any[]>('/v2/menu/all');
}

export function createMenuItem(data: Partial<MenuItemData>) {
  return apiFetch<any>('/v2/menu', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMenuItem(id: string, data: Partial<MenuItemData>) {
  return apiFetch<any>(`/v2/menu/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
