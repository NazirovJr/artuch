import { getQueue, removeFromQueue } from './offlineQueue';
import { apiFetch } from '../api/client';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'last_sync_at';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

export async function syncPush(): Promise<{ synced: number; failed: number }> {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'transaction') {
        await apiFetch('/v2/pos/transactions', { method: 'POST', body: JSON.stringify(item.data) });
      } else if (item.type === 'order') {
        await apiFetch('/v2/orders', { method: 'POST', body: JSON.stringify(item.data) });
      } else if (item.type === 'room_update') {
        await apiFetch(`/v2/rooms/${item.data.number}`, { method: 'PATCH', body: JSON.stringify(item.data) });
      }
      await removeFromQueue(item.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function syncPull(): Promise<any> {
  const online = await isOnline();
  if (!online) return null;

  const lastSyncAt = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const data = await apiFetch<any>('/v2/sync/pull', {
    method: 'POST',
    body: JSON.stringify({ lastSyncAt }),
  });

  if (data?.syncedAt) {
    await AsyncStorage.setItem(LAST_SYNC_KEY, data.syncedAt);
  }

  return data;
}

export async function fullSync(): Promise<void> {
  await syncPush();
  await syncPull();
}
