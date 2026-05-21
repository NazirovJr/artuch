import { apiFetch } from './client';

export interface RefundByEmployee {
  employeeId: string;
  employeeName?: string;
  count: number;
  totalAmount: number;
}

export interface DiscountByEmployee {
  employeeId: string;
  count: number;
  totalAmount: number;
}

export interface ShiftVarianceRow {
  id: string;
  userId: string;
  userName?: string;
  openedAt: string;
  closedAt?: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  closeApprovedBy?: string;
  notes?: string;
}

export interface OrderEditRow {
  id: string;
  orderId: string;
  orderStatusAtEdit: string;
  oldTotal: number;
  newTotal: number;
  changedBy: string;
  changedByName?: string;
  reason?: string;
  approvedBy?: string;
  approvalReason?: string;
  createdAt: string;
}

export interface SkippedCleaningRow {
  id: string;
  roomNumber: number;
  type: string;
  notes?: string;
  supervisorName?: string;
  completedAt?: string;
}

export interface ExceptionsSummary {
  refunds: RefundByEmployee[];
  discounts: DiscountByEmployee[];
  variances: ShiftVarianceRow[];
  orderEdits: OrderEditRow[];
  skippedCleaning: SkippedCleaningRow[];
}

export interface OwnerFeedItem {
  id: string;
  action: string;
  subject: string;
  subjectId?: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  payload?: any;
  createdAt: string;
}

function withRange(
  path: string,
  filters?: { from?: string; to?: string },
): string {
  const params = new URLSearchParams();
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function getExceptionsSummary(filters?: { from?: string; to?: string }) {
  return apiFetch<ExceptionsSummary>(
    withRange('/v2/analytics/exceptions', filters),
  );
}

export function getOwnerFeed(limit = 50) {
  return apiFetch<OwnerFeedItem[]>(`/v2/analytics/owner-feed?limit=${limit}`);
}
