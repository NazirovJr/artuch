import { apiFetch } from './client';

export interface SystemSettings {
  id: string;
  hotelName: string | null;
  hotelAddress: string | null;
  hotelPhone: string | null;
  hotelEmail: string | null;
  hotelWebsite: string | null;
  hotelTaxId: string | null;
  logoUrl: string | null;
  currency: string | null;
  updatedAt: string;
}

export function getSettings(): Promise<SystemSettings> {
  return apiFetch<SystemSettings>('/settings');
}

export function updateSettings(data: Partial<Omit<SystemSettings, 'id' | 'updatedAt'>>): Promise<SystemSettings> {
  return apiFetch<SystemSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
