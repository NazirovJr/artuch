import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Resolve backend base URL.
 *
 * Order:
 *   1. `EXPO_PUBLIC_API_URL` env var (if set at build time) — absolute override.
 *   2. Web browser → `http://localhost:3000/api`.
 *   3. Expo Go on a physical device → derive host IP from the Metro dev-server
 *      URL that Expo injects into `expoConfig.hostUri` (e.g. `192.168.1.103:8081`).
 *   4. Android emulator fallback → `http://10.0.2.2:3000/api` (AVD alias for host).
 *   5. iOS simulator / anything else → `http://localhost:3000/api`.
 *
 * Why this matters: a phone on Wi-Fi cannot resolve `localhost` or `10.0.2.2`
 * — those only mean something on the ПК and inside the Android VM respectively.
 * `hostUri` gives us the LAN IP of the dev machine, which is the only address
 * the phone can reach without extra tunneling.
 */
function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '') + '/api';

  if (IS_WEB) return 'http://localhost:3000/api';

  // hostUri looks like "192.168.1.103:8081"; strip the Metro port.
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;
  if (typeof hostUri === 'string' && hostUri.includes(':')) {
    const host = hostUri.split(':')[0];
    // Ignore loopbacks — those come from emulator runs and we handle them below.
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3000/api`;
    }
  }

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api';
  return 'http://localhost:3000/api';
}

const BASE_URL = resolveBaseUrl();

/** Exposed for the offline outbox so it can replay against the same target. */
export function getBaseUrl(): string {
  return BASE_URL;
}

// Web fallback: use localStorage when SecureStore is unavailable
const storage = {
  async get(key: string): Promise<string | null> {
    if (IS_WEB) return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (IS_WEB) { localStorage.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value);
  },
  async delete(key: string): Promise<void> {
    if (IS_WEB) { localStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
  },
};

let accessToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  accessToken = await storage.get('access_token');
  return accessToken;
}

export async function setToken(token: string): Promise<void> {
  accessToken = token;
  await storage.set('access_token', token);
}

export async function clearToken(): Promise<void> {
  accessToken = null;
  await storage.delete('access_token');
}

export async function getRefreshToken(): Promise<string | null> {
  return storage.get('refresh_token');
}

export async function setRefreshToken(token: string): Promise<void> {
  await storage.set('refresh_token', token);
}

export async function clearRefreshToken(): Promise<void> {
  await storage.delete('refresh_token');
}

/**
 * Error type thrown by apiFetch. Includes the HTTP status so callers can
 * branch on 404 / 409 / etc. without parsing strings, and an `isNetwork`
 * flag for the offline-outbox flow to recognise transport failures
 * distinct from server-returned errors.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isNetwork = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * NestJS's default ValidationPipe returns `message` as an ARRAY of strings
 * — one per failed field — not a single string. Left alone, `new Error(arr)`
 * silently ToStrings it via `Array.prototype.join(',')`, producing a
 * no-space, punctuation-less run-on ("fieldA must be X,fieldB must be Y")
 * in every Alert that just shows `e.message`. Join it properly here so
 * callers get a readable, semicolon-separated sentence instead.
 */
function formatApiMessage(body: any, fallback: string): string {
  const { message } = body ?? {};
  if (Array.isArray(message)) return message.join('; ');
  return message || fallback;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const storedRefreshToken = await getRefreshToken();
  if (!storedRefreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    await setToken(data.access_token);
    await setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lazy reference to the outbox enqueue function — set by initOutboxBridge
 * on app startup. We avoid a hard import here to keep the client code
 * usable in tests without AsyncStorage mocking, and to break the cycle
 * (outbox.ts also imports ApiError from this file).
 */
type EnqueueFn = (item: {
  path: string;
  method: string;
  body: string | null;
  idempotencyKey?: string;
}) => Promise<string>;
let enqueueOutboxFn: EnqueueFn | null = null;

export function registerOutboxEnqueue(fn: EnqueueFn): void {
  enqueueOutboxFn = fn;
}

/**
 * Try to extract `idempotencyKey` from a JSON request body. Best-effort —
 * if the body isn't JSON, we just skip outbox queuing (we'd rather not
 * silently retry without dedup).
 */
function extractIdempotencyKey(body: BodyInit | null | undefined): string | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const parsed = JSON.parse(body);
    return typeof parsed?.idempotencyKey === 'string'
      ? parsed.idempotencyKey
      : undefined;
  } catch {
    return undefined;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (e: any) {
    // Transport failure: queue mutations for later replay if we have an
    // outbox bridge AND the call carries an idempotencyKey (otherwise
    // replay risks duplicates). Reads are not queued — fail fast so the
    // UI can show a stale-data state.
    const method = (options.method || 'GET').toUpperCase();
    const isMutation =
      method === 'POST' ||
      method === 'PATCH' ||
      method === 'PUT' ||
      method === 'DELETE';
    const idempotencyKey = extractIdempotencyKey(options.body);
    if (enqueueOutboxFn && isMutation && idempotencyKey) {
      const queuedId = await enqueueOutboxFn({
        path,
        method,
        body: typeof options.body === 'string' ? options.body : null,
        idempotencyKey,
      });
      // Lazy import to avoid a hard cycle.
      const { QueuedError } = await import('./outbox');
      throw new QueuedError(queuedId);
    }
    throw new ApiError(e?.message || 'Network error', 0, true);
  }

  if (response.status === 401) {
    // Try to refresh the token (deduplicate concurrent refresh attempts)
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false));

    if (refreshed) {
      // Retry the original request with the new access token
      const newToken = await getToken();
      const retryHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (newToken) {
        (retryHeaders as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      }

      const retryResponse = await fetch(`${BASE_URL}${path}`, { ...options, headers: retryHeaders });

      if (!retryResponse.ok) {
        if (retryResponse.status === 401) {
          await clearToken();
          await clearRefreshToken();
          throw new ApiError('Unauthorized', 401);
        }
        const body = await retryResponse.json().catch(() => ({}));
        throw new ApiError(
          formatApiMessage(body, `HTTP ${retryResponse.status}`),
          retryResponse.status,
        );
      }

      if (retryResponse.status === 204) return null as T;
      return retryResponse.json();
    }

    // Refresh failed — clear everything
    await clearToken();
    await clearRefreshToken();
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      formatApiMessage(body, `HTTP ${response.status}`),
      response.status,
    );
  }

  if (response.status === 204) return null as T;
  return response.json();
}
