import { apiFetch } from './client';

export type AlertSeverity = 'warning' | 'critical';
export type AlertSource = 'warehouse' | 'inventory';

export interface LowStockAlert {
  id: string;
  source: AlertSource;
  itemId: string;
  itemName: string;
  warehouseId: string | null;
  currentLevel: number;
  threshold: number;
  severity: AlertSeverity;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export function getLowStockAlerts(
  includeAcknowledged = false,
): Promise<LowStockAlert[]> {
  const q = includeAcknowledged ? '?includeAcknowledged=true' : '';
  return apiFetch<LowStockAlert[]>(`/alerts/low-stock${q}`);
}

export function acknowledgeAlert(
  id: string,
  acknowledgedBy: string,
): Promise<LowStockAlert> {
  return apiFetch<LowStockAlert>(`/alerts/low-stock/${id}/acknowledge`, {
    method: 'PATCH',
    body: JSON.stringify({ acknowledgedBy }),
  });
}
