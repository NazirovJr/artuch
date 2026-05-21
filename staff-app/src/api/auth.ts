import { apiFetch, setToken, clearToken, setRefreshToken, clearRefreshToken, getRefreshToken } from './client';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  await setToken(data.access_token);
  await setRefreshToken(data.refresh_token);
  return data;
}

export async function pinLogin(pin: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/pin-login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
  await setToken(data.access_token);
  await setRefreshToken(data.refresh_token);
  return data;
}

export async function refreshTokens(): Promise<{ access_token: string; refresh_token: string }> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const data = await apiFetch<{ access_token: string; refresh_token: string }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  await setToken(data.access_token);
  await setRefreshToken(data.refresh_token);
  return data;
}

export async function getMe(): Promise<LoginResponse['user']> {
  return apiFetch<LoginResponse['user']>('/auth/me');
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Ignore errors during logout — we clear tokens regardless
  }
  await clearToken();
  await clearRefreshToken();
}
