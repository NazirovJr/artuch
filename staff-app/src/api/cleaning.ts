import { apiFetch } from './client';

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
}

export interface CleaningChecklistTemplate {
  id: string;
  name: string;
  type: string;
  items: ChecklistItem[];
  isActive: boolean;
}

export interface CleaningTask {
  id: string;
  roomNumber: number;
  type: 'departure' | 'stayover' | 'deep' | 'inspection';
  status: 'pending' | 'in-progress' | 'review' | 'done' | 'skipped';
  reservationId?: string;
  assignedTo?: string;
  assignedToName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  supervisorId?: string;
  supervisorName?: string;
  supervisorApprovedAt?: string | null;
  notes?: string;
  photos?: string[] | null;
  checklistResult?: Record<string, boolean>;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export function listCleaningTasks(params: {
  status?: string;
  assignedTo?: string;
  type?: string;
  roomNumber?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.assignedTo) query.append('assignedTo', params.assignedTo);
  if (params.type) query.append('type', params.type);
  if (params.roomNumber) query.append('roomNumber', String(params.roomNumber));
  const qs = query.toString();
  return apiFetch<CleaningTask[]>(
    `/v2/cleaning/tasks${qs ? `?${qs}` : ''}`,
  );
}

export function getCleaningTask(id: string) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}`);
}

export function listChecklistTemplates() {
  return apiFetch<CleaningChecklistTemplate[]>('/v2/cleaning/checklists');
}

export function assignCleaningTask(id: string, userId: string) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function startCleaningTask(id: string) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function submitCleaningTask(
  id: string,
  body: {
    checklistResult?: Record<string, boolean>;
    notes?: string;
    photos?: string[];
  },
) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function approveCleaningTask(id: string) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rejectCleaningTask(id: string, notes: string) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function skipCleaningTask(id: string, reason: string) {
  return apiFetch<CleaningTask>(`/v2/cleaning/tasks/${id}/skip`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function generateStayoverTasks() {
  return apiFetch<{ created: number }>(
    '/v2/cleaning/tasks/generate-stayovers',
    { method: 'POST', body: JSON.stringify({}) },
  );
}
