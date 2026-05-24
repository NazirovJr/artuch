import { apiFetch, getBaseUrl, getToken } from './client';
import { downloadAndShareFile } from '../utils/saveFile';

/** Shared filter shape for list / summary / export. */
export interface ExpenseQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  group?: string;
  outletId?: string;
  paymentMethod?: string;
  status?: string;
  q?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  group: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface Expense {
  id: string;
  expenseNumber: number;
  categoryId: string;
  categoryName: string;
  amount: number;
  paymentMethod: string;
  spentAt: string;
  description?: string;
  supplierId?: string;
  vendor?: string;
  outletId?: string;
  recordedBy?: string;
  recordedByName?: string;
  shiftId?: string;
  status: 'recorded' | 'void';
  voidReason?: string;
  createdAt: string;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: { categoryId: string; name: string; amount: number; count: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

export interface CreateExpenseInput {
  categoryId: string;
  amount: number;
  paymentMethod?: string;
  spentAt: string;
  description?: string;
  supplierId?: string;
  vendor?: string;
  outletId?: string;
}

export interface ExpenseCategoryInput {
  name: string;
  description?: string;
  group?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** Payment methods an expense can be paid with (matches backend enum). */
export const EXPENSE_PAYMENT_METHODS: { value: string; label: string; icon: string }[] = [
  { value: 'cash', label: 'Наличные', icon: 'cash' },
  { value: 'card', label: 'Карта', icon: 'credit-card-outline' },
  { value: 'bank', label: 'Банк', icon: 'bank-outline' },
  { value: 'other', label: 'Прочее', icon: 'dots-horizontal' },
];

/** Category groups for the P&L breakdown (matches backend enum). */
export const EXPENSE_GROUPS: { value: string; label: string }[] = [
  { value: 'rent', label: 'Аренда' },
  { value: 'payroll', label: 'Зарплаты' },
  { value: 'utilities', label: 'Коммунальные' },
  { value: 'supplies', label: 'Закупки' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'marketing', label: 'Маркетинг' },
  { value: 'maintenance', label: 'Ремонт' },
  { value: 'tax', label: 'Налоги' },
  { value: 'other', label: 'Прочее' },
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

function rangeQuery(filters: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ── Expenses ──────────────────────────────────────────────────────────
export function getExpenses(filters: ExpenseQuery = {}) {
  return apiFetch<Expense[]>(`/v2/expenses${rangeQuery(filters)}`);
}

export function getExpenseSummary(filters: ExpenseQuery = {}) {
  return apiFetch<ExpenseSummary>(`/v2/expenses/summary${rangeQuery(filters)}`);
}

/** Download/share an XLSX of the filtered expense register. */
export async function exportExpensesXlsx(filters: ExpenseQuery = {}): Promise<void> {
  const url = `${getBaseUrl()}/v2/expenses/export.xlsx${rangeQuery(filters)}`;
  const token = await getToken();
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadAndShareFile(
    url,
    token,
    `artuch-expenses-${stamp}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

export function createExpense(data: CreateExpenseInput) {
  return apiFetch<Expense>('/v2/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function voidExpense(id: string, reason?: string) {
  return apiFetch<Expense>(`/v2/expenses/${id}/void`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

// ── Categories ────────────────────────────────────────────────────────
export function getExpenseCategories(includeInactive = false) {
  return apiFetch<ExpenseCategory[]>(
    `/v2/expense-categories${includeInactive ? '?includeInactive=true' : ''}`,
  );
}

export function createExpenseCategory(data: ExpenseCategoryInput) {
  return apiFetch<ExpenseCategory>('/v2/expense-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateExpenseCategory(id: string, data: Partial<ExpenseCategoryInput>) {
  return apiFetch<ExpenseCategory>(`/v2/expense-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteExpenseCategory(id: string) {
  return apiFetch<void>(`/v2/expense-categories/${id}`, { method: 'DELETE' });
}
