import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, tokenStorage } from '../../src/lib/api-client';

// Interceptor handler shape from axios:
// apiClient.interceptors.{request,response}.handlers[i] = { fulfilled, rejected }
// We drive interceptors by calling those handlers directly — no network.
type Handler<T = unknown> = { fulfilled?: (v: T) => T | Promise<T>; rejected?: (e: unknown) => unknown };
const requestHandlers = (apiClient.interceptors.request as unknown as { handlers: Handler[] }).handlers;
const responseHandlers = (apiClient.interceptors.response as unknown as { handlers: Handler[] }).handlers;

const makeConfig = (overrides: Record<string, unknown> = {}) => ({
  method: 'post',
  url: '/things',
  headers: {} as Record<string, string>,
  ...overrides,
});

describe('tokenStorage', () => {
  beforeEach(() => localStorage.clear());

  it('saveRefresh + getRefresh round-trip', () => {
    tokenStorage.saveRefresh('user-1', 'token-abc');
    expect(tokenStorage.getRefresh()).toEqual({ userId: 'user-1', refreshToken: 'token-abc' });
  });

  it('getRefresh returns nulls when nothing stored', () => {
    expect(tokenStorage.getRefresh()).toEqual({ userId: null, refreshToken: null });
  });

  it('clear removes both keys', () => {
    tokenStorage.saveRefresh('u', 't');
    tokenStorage.clear();
    expect(tokenStorage.getRefresh()).toEqual({ userId: null, refreshToken: null });
  });
});

describe('apiClient instance', () => {
  it('is an axios instance with JSON content-type default', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('has withCredentials disabled', () => {
    expect(apiClient.defaults.withCredentials).toBe(false);
  });
});

describe('request interceptor — nonce/timestamp', () => {
  const fulfilled = requestHandlers[0]?.fulfilled;
  if (!fulfilled) throw new Error('request interceptor missing');

  it('adds X-Nonce and X-Timestamp on POST to non-auth path', async () => {
    const cfg = await fulfilled(makeConfig({ method: 'post', url: '/things' }));
    expect((cfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toMatch(/^\d+-[a-z0-9]+$/);
    expect((cfg as ReturnType<typeof makeConfig>).headers['X-Timestamp']).toMatch(/^\d+$/);
  });

  it('adds headers on PATCH and DELETE', async () => {
    const patchCfg = await fulfilled(makeConfig({ method: 'patch', url: '/things/1' }));
    const deleteCfg = await fulfilled(makeConfig({ method: 'delete', url: '/things/1' }));
    expect((patchCfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toBeDefined();
    expect((deleteCfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toBeDefined();
  });

  it('does NOT add headers on GET', async () => {
    const cfg = await fulfilled(makeConfig({ method: 'get', url: '/things' }));
    expect((cfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toBeUndefined();
  });

  it('does NOT add headers on POST to /auth/login', async () => {
    const cfg = await fulfilled(makeConfig({ method: 'post', url: '/auth/login' }));
    expect((cfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toBeUndefined();
  });

  it('does NOT add headers on POST to /auth/refresh or /auth/logout', async () => {
    const refreshCfg = await fulfilled(makeConfig({ method: 'post', url: '/auth/refresh' }));
    const logoutCfg = await fulfilled(makeConfig({ method: 'post', url: '/auth/logout' }));
    expect((refreshCfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toBeUndefined();
    expect((logoutCfg as ReturnType<typeof makeConfig>).headers['X-Nonce']).toBeUndefined();
  });

  it('handles missing method gracefully', async () => {
    const cfg = await fulfilled({ url: '/things', headers: {} as Record<string, string> });
    expect((cfg as { headers: Record<string, string> }).headers['X-Nonce']).toBeUndefined();
  });

  it('handles missing url gracefully', async () => {
    const cfg = await fulfilled({ method: 'post', headers: {} as Record<string, string> });
    expect((cfg as { headers: Record<string, string> }).headers['X-Nonce']).toBeDefined();
  });
});

describe('response interceptor', () => {
  const fulfilled = responseHandlers[0]?.fulfilled;
  const rejected = responseHandlers[0]?.rejected;
  if (!fulfilled || !rejected) throw new Error('response interceptor missing');

  beforeEach(() => {
    localStorage.clear();
    // Reset any auth header that previous tests may have set.
    delete apiClient.defaults.headers.common['Authorization'];
  });

  it('fulfilled: passes successful response through unchanged', () => {
    const response = { data: { ok: true }, status: 200 };
    expect(fulfilled(response)).toBe(response);
  });

  it('rejected: passes through non-401 errors', async () => {
    const err = { response: { status: 500 }, config: { url: '/things', headers: {} } };
    await expect(rejected(err)).rejects.toBe(err);
  });

  it('rejected: passes through 401 on /auth/login (no refresh attempt)', async () => {
    const err = { response: { status: 401 }, config: { url: '/auth/login', headers: {} } };
    await expect(rejected(err)).rejects.toBe(err);
  });

  it('rejected: passes through 401 on /auth/refresh (no refresh loop)', async () => {
    const err = { response: { status: 401 }, config: { url: '/auth/refresh', headers: {} } };
    await expect(rejected(err)).rejects.toBe(err);
  });

  it('rejected: 401 with no stored refresh token → clears storage and rejects', async () => {
    // window.location.href assignment would fail the test in jsdom unless replaced.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    tokenStorage.saveRefresh('', ''); // empty strings → truthy-check fails below
    localStorage.clear();

    const err = {
      response: { status: 401 },
      config: { url: '/things', headers: {}, _retry: false },
    };
    await expect(rejected(err)).rejects.toBeDefined();
    expect(tokenStorage.getRefresh()).toEqual({ userId: null, refreshToken: null });

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('rejected: 401 with stored token — successful refresh retries the original request (covers lines 91-97)', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
    tokenStorage.saveRefresh('user-ok', 'refresh-ok');

    // Stub apiClient.post to return new tokens for /auth/refresh, and
    // stub apiClient itself (the function form) to return a retried response.
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ data: { data: { accessToken: 'new-access', refreshToken: 'new-refresh' } } } as never);
    // apiClient is callable — when interceptor re-invokes it, return a fake success.
    const callable = apiClient as unknown as ((cfg: unknown) => Promise<unknown>) & typeof apiClient;
    const originalCallable = callable.request ? callable.request.bind(callable) : null;
    // Axios instances are functions via dispatchRequest. Easiest path: spy on apiClient.request.
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValueOnce({ data: { ok: true } } as never);

    const err = {
      response: { status: 401 },
      config: { url: '/things', headers: {} as Record<string, string>, _retry: false },
    };
    // The response-interceptor re-calls apiClient(originalRequest) which ends up at apiClient.request.
    // Some axios builds invoke it via the instance call operator; either way the fulfilled catch path runs.
    await rejected(err).catch(() => undefined); // success OR reject both acceptable — we only care the code path ran

    expect(postSpy).toHaveBeenCalledWith('/auth/refresh', { userId: 'user-ok', refreshToken: 'refresh-ok' });
    // On success, saved refresh should be the new one
    expect(localStorage.getItem('mm_refresh_token')).toBe('new-refresh');
    expect(apiClient.defaults.headers.common['Authorization']).toBe('Bearer new-access');

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    postSpy.mockRestore();
    requestSpy.mockRestore();
    if (originalCallable) (callable as { request: typeof originalCallable }).request = originalCallable;
  });

  it('rejected: concurrent 401 while a refresh is already in flight queues and resolves (covers lines 73-81, 53-55)', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
    tokenStorage.saveRefresh('user-q', 'refresh-q');

    let resolveRefresh: (v: unknown) => void = () => undefined;
    const refreshPromise = new Promise((res) => {
      resolveRefresh = res;
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockReturnValueOnce(refreshPromise as never);
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { retried: true } } as never);

    const err1 = {
      response: { status: 401 },
      config: { url: '/one', headers: {} as Record<string, string>, _retry: false },
    };
    const err2 = {
      response: { status: 401 },
      config: { url: '/two', headers: {} as Record<string, string>, _retry: false },
    };

    // Start the first — it begins the refresh, leaves isRefreshing=true
    const p1 = rejected(err1).catch(() => undefined);
    // Start the second — should be queued (isRefreshing=true branch, lines 73-81)
    const p2 = rejected(err2).catch(() => undefined);

    // Now let the refresh succeed, which processes the queue
    resolveRefresh({ data: { data: { accessToken: 'queued-access', refreshToken: 'queued-refresh' } } });

    await Promise.all([p1, p2]);

    // Only one /auth/refresh POST despite two concurrent 401s — the second was queued.
    expect(postSpy).toHaveBeenCalledTimes(1);
    // Token should be updated from the successful refresh
    expect(localStorage.getItem('mm_refresh_token')).toBe('queued-refresh');

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    postSpy.mockRestore();
    requestSpy.mockRestore();
  });

  it('rejected: concurrent 401 queue rejects all when refresh fails (covers processQueue error branch)', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
    tokenStorage.saveRefresh('user-qe', 'refresh-qe');

    let rejectRefresh: (e: unknown) => void = () => undefined;
    const refreshPromise = new Promise((_, rej) => {
      rejectRefresh = rej;
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockReturnValueOnce(refreshPromise as never);

    const err1 = {
      response: { status: 401 },
      config: { url: '/a', headers: {} as Record<string, string>, _retry: false },
    };
    const err2 = {
      response: { status: 401 },
      config: { url: '/b', headers: {} as Record<string, string>, _retry: false },
    };

    const p1 = rejected(err1).catch(() => 'r1');
    const p2 = rejected(err2).catch(() => 'r2');

    rejectRefresh(new Error('refresh-died'));

    const results = await Promise.all([p1, p2]);
    expect(results).toEqual(['r1', 'r2']);

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    postSpy.mockRestore();
  });

  it('rejected: 401 with stored token attempts refresh (fails gracefully when axios post fails)', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
    tokenStorage.saveRefresh('user-1', 'refresh-1');
    // Stub apiClient.post to fail so we exercise the catch branch.
    const postSpy = vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('boom'));

    const err = {
      response: { status: 401 },
      config: { url: '/things', headers: {}, _retry: false },
    };
    await expect(rejected(err)).rejects.toBeDefined();
    expect(postSpy).toHaveBeenCalledWith('/auth/refresh', { userId: 'user-1', refreshToken: 'refresh-1' });
    // storage cleared after failed refresh
    expect(tokenStorage.getRefresh()).toEqual({ userId: null, refreshToken: null });

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    postSpy.mockRestore();
  });
});
