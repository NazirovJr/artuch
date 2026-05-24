import { apiFetch } from './client';

export interface FolioCharge {
  id?: string;
  chargeType: string;
  description: string;
  amount: number | string;
  quantity?: number;
  unitPrice?: number;
  createdAt?: string;
}

export interface Folio {
  id: string;
  status?: string;
  roomNumber?: number | null;
  guestId?: string | null;
  openedAt?: string;
  closedAt?: string | null;
  totalAmount: number | string;
  paidAmount: number | string;
  notes?: string | null;
  invoiceNumber?: number;
  charges?: FolioCharge[];
  reservation?: any;
  paymentType?: string;
}

export function getFolios(status?: string) {
  const query = status ? `?status=${status}` : '';
  return apiFetch<Folio[]>(`/v2/folios${query}`);
}

export function getFolio(id: string) {
  return apiFetch<Folio>(`/v2/folios/${id}`);
}

export function createFolio(data: { guestId?: string; reservationId?: string; roomNumber?: number; notes?: string }) {
  return apiFetch<Folio>('/v2/folios', { method: 'POST', body: JSON.stringify(data) });
}

export function addCharge(folioId: string, data: { chargeType: string; description: string; amount: number; sourceId?: string }) {
  return apiFetch<Folio>(`/v2/folios/${folioId}/charges`, { method: 'POST', body: JSON.stringify(data) });
}

export function addPayment(folioId: string, data: { amount: number; description?: string }) {
  return apiFetch<any>(`/v2/folios/${folioId}/payments`, { method: 'POST', body: JSON.stringify(data) });
}

export function addDeposit(folioId: string, data: { amount: number; description?: string }) {
  return apiFetch<any>(`/v2/folios/${folioId}/deposits`, { method: 'POST', body: JSON.stringify(data) });
}

export function addDiscount(folioId: string, data: { amount: number; description: string }) {
  return apiFetch<any>(`/v2/folios/${folioId}/discounts`, { method: 'POST', body: JSON.stringify(data) });
}

export function closeFolio(folioId: string) {
  return apiFetch<any>(`/v2/folios/${folioId}/close`, { method: 'POST' });
}

/**
 * Send the pre-rendered HTML receipt to the guest's email.
 * Body must be a full HTML document; the backend sanitises script/iframe
 * tags then forwards verbatim (template lives on the client, not in Node).
 */
export function emailFolioReceipt(
  folioId: string,
  data: { html: string; subject?: string },
) {
  return apiFetch<{ sent: boolean; to: string }>(
    `/v2/folios/${folioId}/email-receipt`,
    { method: 'POST', body: JSON.stringify(data) },
  );
}
