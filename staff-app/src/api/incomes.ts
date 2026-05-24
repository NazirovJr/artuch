import { apiFetch, getBaseUrl, getToken } from './client';
import { downloadAndShareFile } from '../utils/saveFile';

/** Shared filter shape for list / summary / export. */
export interface IncomeQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  group?: string;
  outletId?: string;
  paymentMethod?: string;
  status?: string;
  q?: string;
}

export interface IncomeCategory {
  id: string;
  name: string;
  description?: string;
  group: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface Income {
  id: string;
  incomeNumber: number;
  categoryId: string;
  categoryName: string;
  amount: number;
  paymentMethod: string;
  receivedAt: string;
  description?: string;
  payer?: string;
  outletId?: string;
  recordedBy?: string;
  recordedByName?: string;
  shiftId?: string;
  status: 'recorded' | 'void';
  voidReason?: string;
  createdAt: string;
}

export interface IncomeSummary {
  total: number;
  count: number;
  byCategory: { categoryId: string; name: string; amount: number; count: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

export interface CreateIncomeInput {
  categoryId: string;
  amount: number;
  paymentMethod?: string;
  receivedAt: string;
  description?: string;
  payer?: string;
  outletId?: string;
}

export interface IncomeCategoryInput {
  name: string;
  description?: string;
  group?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** Payment methods an income can be received with (matches backend enum). */
export const INCOME_PAYMENT_METHODS: { value: string; label: string; icon: string }[] = [
  { value: 'cash', label: 'Наличные', icon: 'cash' },
  { value: 'card', label: 'Карта', icon: 'credit-card-outline' },
  { value: 'bank', label: 'Банк', icon: 'bank-outline' },
  { value: 'other', label: 'Прочее', icon: 'dots-horizontal' },
];

/** Category groups for the P&L breakdown (matches backend enum). */
export const INCOME_GROUPS: { value: string; label: string }[] = [
  { value: 'service', label: 'Доп. услуги' },
  { value: 'rent', label: 'Аренда' },
  { value: 'event', label: 'Мероприятия' },
  { value: 'asset', label: 'Продажа имущества' },
  { value: 'partner', label: 'Партнёрские' },
  { value: 'grant', label: 'Субсидии и гранты' },
  { value: 'other', label: 'Прочее' },
];

export const INCOME_PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  INCOME_PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

function rangeQuery(filters: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Incomes ───────────────────────────────────────────────────────────
export function getIncomes(filters: IncomeQuery = {}) {
  return apiFetch<Income[]>(`/v2/incomes${rangeQuery(filters)}`);
}

export function getIncomeSummary(filters: IncomeQuery = {}) {
  return apiFetch<IncomeSummary>(`/v2/incomes/summary${rangeQuery(filters)}`);
}

/** Download/share an XLSX of the filtered income register. */
export async function exportIncomesXlsx(filters: IncomeQuery = {}): Promise<void> {
  const url = `${getBaseUrl()}/v2/incomes/export.xlsx${rangeQuery(filters)}`;
  const token = await getToken();
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadAndShareFile(
    url,
    token,
    `artuch-incomes-${stamp}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

export function createIncome(data: CreateIncomeInput) {
  return apiFetch<Income>('/v2/incomes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function voidIncome(id: string, reason?: string) {
  return apiFetch<Income>(`/v2/incomes/${id}/void`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

// ── Categories ────────────────────────────────────────────────────────
export function getIncomeCategories(includeInactive = false) {
  return apiFetch<IncomeCategory[]>(
    `/v2/income-categories${includeInactive ? '?includeInactive=true' : ''}`,
  );
}

export function createIncomeCategory(data: IncomeCategoryInput) {
  return apiFetch<IncomeCategory>('/v2/income-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateIncomeCategory(id: string, data: Partial<IncomeCategoryInput>) {
  return apiFetch<IncomeCategory>(`/v2/income-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteIncomeCategory(id: string) {
  return apiFetch<void>(`/v2/income-categories/${id}`, { method: 'DELETE' });
}
