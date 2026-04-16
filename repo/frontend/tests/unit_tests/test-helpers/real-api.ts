/**
 * Real-API test helper.
 *
 * Uses a FRESH axios instance (no interceptors) to avoid DataCloneError
 * when vitest serializes across forks. This instance points at the real
 * NestJS backend so tests exercise real HTTP + real DB behavior.
 */
import axios from 'axios';

function pickBaseUrl(): string {
  const env: Record<string, string | undefined> =
    (typeof process !== 'undefined' && (process as Record<string, unknown>).env as Record<string, string | undefined>) || {};
  return (
    env.E2E_API_URL ||
    env.VITE_API_URL ||
    'http://localhost:4000'
  );
}

export const API_BASE_URL = pickBaseUrl();

/** Plain axios instance — no interceptors, no closure serialization issues. */
export const testApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

export type RoleName = 'admin' | 'supervisor' | 'hr' | 'employee';

export interface LoggedInUser {
  userId: string;
  username: RoleName;
  role: RoleName;
  accessToken: string;
  refreshToken: string;
}

const credentialCache: Partial<Record<RoleName, LoggedInUser>> = {};

/**
 * Log in against the real backend. Installs the bearer token on `testApi`
 * for subsequent calls.
 */
export async function loginAs(role: RoleName): Promise<LoggedInUser> {
  if (credentialCache[role]) {
    const cached = credentialCache[role]!;
    testApi.defaults.headers.common['Authorization'] = `Bearer ${cached.accessToken}`;
    return cached;
  }

  const res = await testApi.post('/auth/login', {
    username: role,
    password: 'meridian2024',
  });
  const payload = res.data?.data ?? res.data;
  const { accessToken, refreshToken, userId } = payload;

  testApi.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

  const user: LoggedInUser = {
    userId,
    username: role,
    role,
    accessToken,
    refreshToken,
  };
  credentialCache[role] = user;
  return user;
}

export function clearAuth(): void {
  delete testApi.defaults.headers.common['Authorization'];
}

export async function backendIsReachable(): Promise<boolean> {
  try {
    await testApi.post('/auth/login', {}).catch((err) => {
      if (err?.response) return err.response;
      throw err;
    });
    return true;
  } catch {
    return false;
  }
}
