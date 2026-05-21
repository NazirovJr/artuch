import { apiFetch } from './client';

export function registerPushToken(token: string, platform = 'android') {
  return apiFetch('/v2/notifications/register', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export function unregisterPushToken() {
  return apiFetch('/v2/notifications/unregister', { method: 'DELETE' });
}
