import { apiFetch } from './client';

export function getAuditLog(filters?: {
  userId?: string;
  subject?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.subject) params.append('subject', filters.subject);
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<any[]>(`/v2/audit-log${query}`);
}
