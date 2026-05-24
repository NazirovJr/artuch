import { apiFetch, getBaseUrl, getToken } from './client';
import { downloadAndShareFile } from '../utils/saveFile';

export interface FinanceSummary {
  range: { from: string; to: string };
  revenue: {
    gross: number;
    net: number;
    refunds: number;
    discounts: number;
    count: number;
    byOutlet: { type: string; label: string; amount: number; count: number }[];
    byCategory: { name: string; qty: number; amount: number }[];
    byPaymentMethod: { method: string; label: string; amount: number }[];
  };
  rooms: {
    revenue: number;
    roomNights: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    byRoomType: { code: string; name: string; revenue: number; nights: number; reservations: number }[];
  };
  rentals: { revenue: number; count: number; byItem: { itemName: string; revenue: number; qty: number }[] };
  receivables: {
    paid: number;
    outstanding: number;
    openFolios: number;
    depositsHeld: number;
    aging: { bucket: string; amount: number; count: number }[];
  };
  cogs: { goodsRevenue: number; cost: number; grossProfit: number; marginPct: number };
  expenses: {
    total: number;
    count: number;
    byCategory: { name: string; amount: number; count: number }[];
    byPaymentMethod: { method: string; label: string; amount: number }[];
  };
  otherIncome: {
    total: number;
    count: number;
    byCategory: { name: string; amount: number; count: number }[];
    byPaymentMethod: { method: string; label: string; amount: number }[];
  };
  profit: { operatingProfit: number; marginPct: number };
  comparison: {
    prev: { from: string; to: string };
    revenuePrev: number;
    deltaPct: number | null;
    current: { revenue: number; count: number }[];
    previous: { revenue: number; count: number }[];
  };
}

export type FinanceScope = 'all' | 'income' | 'expense';

export interface FinanceQuery {
  from?: string;
  to?: string;
  outletId?: string;
  paymentMethod?: string;
}

function queryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function getFinanceSummary(from?: string, to?: string, q: Omit<FinanceQuery, 'from' | 'to'> = {}) {
  return apiFetch<FinanceSummary>(
    `/v2/finance/summary${queryString({ from, to, ...q })}`,
  );
}

/** Triggers an XLSX download/share of the finance report, scoped + filtered. */
export async function exportFinanceXlsx(
  q: FinanceQuery & { scope?: FinanceScope } = {},
): Promise<void> {
  const url = `${getBaseUrl()}/v2/finance/export.xlsx${queryString(q)}`;
  const token = await getToken();
  const stamp = new Date().toISOString().slice(0, 10);
  const tag = q.scope && q.scope !== 'all' ? `-${q.scope}` : '';
  await downloadAndShareFile(
    url,
    token,
    `artuch-finance${tag}-${stamp}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
