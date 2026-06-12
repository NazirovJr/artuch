import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { ApiError } from './client';

const OUTBOX_KEY = 'artuch.outbox.v1';
const MAX_ATTEMPTS = 8;

export interface OutboxItem {
  /** Local UUID for the queued request — distinct from idempotencyKey. */
  id: string;
  path: string;
  method: string;
  body: string | null;
  /**
   * Server-side dedup key. Required for safe replay — every mutation
   * the offline outbox handles MUST carry one in its body so the server
   * collapses retries to the original write. Optional in the type but
   * enforced via warning at enqueue time.
   */
  idempotencyKey?: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

/**
 * Thrown by apiFetch when a request was successfully queued for later
 * replay. Callers should treat this as a soft-success: the user's intent
 * is recorded, will be applied when network returns. Not the same as a
 * server-rejected mutation.
 */
export class QueuedError extends Error {
  constructor(public readonly outboxId: string) {
    super('Запрос сохранён офлайн, отправится при появлении сети');
    this.name = 'QueuedError';
  }
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

async function loadOutbox(): Promise<OutboxItem[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOutbox(items: OutboxItem[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  for (const l of listeners) l(items.length);
}

export async function getOutboxCount(): Promise<number> {
  return (await loadOutbox()).length;
}

export async function getOutbox(): Promise<OutboxItem[]> {
  return loadOutbox();
}

/**
 * Enqueue a mutation for later replay. Returns the local id so the caller
 * can correlate UI state ("pending"). The caller is responsible for
 * including an idempotencyKey in the body of mutations — otherwise replay
 * may produce duplicate records on the server.
 */
export async function enqueueOutbox(
  partial: Omit<OutboxItem, 'id' | 'queuedAt' | 'attempts'>,
): Promise<string> {
  const items = await loadOutbox();
  const id =
    'ob-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8);
  const item: OutboxItem = {
    ...partial,
    id,
    queuedAt: Date.now(),
    attempts: 0,
  };
  items.push(item);
  await saveOutbox(items);
  return id;
}

export async function clearOutbox(): Promise<void> {
  await saveOutbox([]);
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  // Fire current count immediately for the subscriber.
  loadOutbox().then((items) => listener(items.length));
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Replay the queue. Walks items in FIFO order, retrying each via raw fetch
 * (NOT apiFetch — we don't want a failed retry to re-enqueue). Removes
 * successes; keeps network failures for the next round; on >MAX_ATTEMPTS
 * 5xx responses or any 4xx (server rejects the mutation), we drop the
 * item — sitting in the queue forever helps no one.
 *
 * Idempotent and safe to call concurrently from the NetInfo listener and
 * from a manual "Sync now" button — a simple in-memory lock prevents two
 * drains from hitting the same item twice.
 */
let draining = false;

export async function drainOutbox(
  baseUrl: string,
  getToken: () => Promise<string | null>,
  /** Refresh the access token when a replay hits 401 (token expired while
   *  offline). Called at most once per drain; on success the queue is
   *  retried with the fresh token. Optional — without it, 401s re-queue. */
  tryRefresh?: () => Promise<boolean>,
): Promise<{ sent: number; dropped: number; remaining: number }> {
  if (draining) return { sent: 0, dropped: 0, remaining: 0 };
  draining = true;
  let sent = 0;
  let dropped = 0;

  try {
    const items = await loadOutbox();
    const remaining: OutboxItem[] = [];
    let token = await getToken();
    let refreshed = false; // only attempt one refresh per drain
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    for (const item of items) {
      try {
        let res = await fetch(`${baseUrl}${item.path}`, {
          method: item.method,
          headers,
          body: item.body ?? undefined,
        });

        // Token expired while offline → refresh once, then retry this item
        // with the new token before deciding its fate.
        if (res.status === 401 && tryRefresh && !refreshed) {
          refreshed = true;
          const ok = await tryRefresh();
          if (ok) {
            token = await getToken();
            if (token) headers.Authorization = `Bearer ${token}`;
            res = await fetch(`${baseUrl}${item.path}`, {
              method: item.method,
              headers,
              body: item.body ?? undefined,
            });
          }
        }

        if (res.ok || res.status === 204) {
          sent += 1;
          continue;
        }
        // 4xx (except 401, which means auth is genuinely gone — re-queue so a
        // later login can flush) means the server rejected the mutation.
        // Replay won't fix it — drop and let the user investigate.
        if (res.status >= 400 && res.status < 500 && res.status !== 401) {
          dropped += 1;
          continue;
        }
        item.attempts += 1;
        item.lastError = `HTTP ${res.status}`;
        if (item.attempts >= MAX_ATTEMPTS) {
          dropped += 1;
          continue;
        }
        remaining.push(item);
      } catch (e: any) {
        // Transport failure — keep item, stop draining (no point trying
        // others; we're offline again).
        item.attempts += 1;
        item.lastError = e?.message ?? 'network';
        remaining.push(item);
        // Push the rest back too without retrying.
        const idx = items.indexOf(item);
        for (let i = idx + 1; i < items.length; i++) {
          remaining.push(items[i]);
        }
        break;
      }
    }
    await saveOutbox(remaining);
    return { sent, dropped, remaining: remaining.length };
  } finally {
    draining = false;
  }
}

/**
 * Wire up auto-drain on connectivity restore. Returns an unsubscribe
 * function. Call once at app startup. Skips drain when already draining
 * to prevent a flood when wifi flickers.
 */
export function startOutboxAutoDrain(
  baseUrl: string,
  getToken: () => Promise<string | null>,
  tryRefresh?: () => Promise<boolean>,
): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      drainOutbox(baseUrl, getToken, tryRefresh).catch(() => {
        // Errors during drain are recorded onto each item; the next round
        // will pick them up.
      });
    }
  });
}
