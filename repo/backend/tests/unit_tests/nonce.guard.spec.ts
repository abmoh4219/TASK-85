import { Reflector } from '@nestjs/core';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { NonceGuard } from '../../src/common/guards/nonce.guard';

const makeCtx = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext);

describe('NonceGuard', () => {
  let guard: NonceGuard;
  let reflector: Reflector;
  let dataSource: { query: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    dataSource = { query: jest.fn() };
    guard = new NonceGuard(dataSource as any, reflector);
  });

  it('allows GET requests without nonce validation', async () => {
    const ctx = makeCtx({ method: 'GET', headers: {}, baseUrl: '', path: '/anything' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('allows exempt path (auth/login) with missing headers', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    const ctx = makeCtx({
      method: 'POST',
      headers: {},
      baseUrl: '',
      path: '/auth/login',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows public routes with missing headers', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    const ctx = makeCtx({
      method: 'POST',
      headers: {},
      baseUrl: '',
      path: '/whatever',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects missing headers on non-exempt POST', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    const ctx = makeCtx({
      method: 'POST',
      headers: {},
      baseUrl: '',
      path: '/procurement/requests',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('rejects when timestamp is NaN', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    const ctx = makeCtx({
      method: 'POST',
      headers: { 'x-nonce': 'n1', 'x-timestamp': 'notanumber' },
      baseUrl: '',
      path: '/procurement/requests',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/timestamp/);
  });

  it('rejects when timestamp is stale', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    const ctx = makeCtx({
      method: 'POST',
      headers: { 'x-nonce': 'n1', 'x-timestamp': String(Date.now() - 10 * 60 * 1000) },
      baseUrl: '',
      path: '/procurement/requests',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/timestamp/);
  });

  it('rejects duplicate nonce', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    dataSource.query.mockResolvedValueOnce([{ id: 'existing' }]);
    const ctx = makeCtx({
      method: 'POST',
      headers: { 'x-nonce': 'n1', 'x-timestamp': String(Date.now()) },
      baseUrl: '',
      path: '/procurement/requests',
      user: { id: 'user-1' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Duplicate nonce/);
  });

  it('accepts and inserts a fresh nonce (with verified user id)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    dataSource.query
      .mockResolvedValueOnce([]) // SELECT
      .mockResolvedValueOnce(undefined) // INSERT
      .mockResolvedValueOnce(undefined); // DELETE cleanup
    const ctx = makeCtx({
      method: 'PATCH',
      headers: { 'x-nonce': 'n-fresh', 'x-timestamp': String(Date.now()) },
      baseUrl: '',
      path: '/inventory/items/1',
      user: { id: 'user-1' },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(dataSource.query).toHaveBeenCalled();
  });

  it('accepts anonymous request without user', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    dataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const ctx = makeCtx({
      method: 'DELETE',
      headers: { 'x-nonce': 'n2', 'x-timestamp': String(Date.now()) },
      baseUrl: '',
      path: '/projects/1',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('fails safe when DB throws on SELECT', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    dataSource.query.mockRejectedValueOnce(new Error('db down'));
    const ctx = makeCtx({
      method: 'POST',
      headers: { 'x-nonce': 'n3', 'x-timestamp': String(Date.now()) },
      baseUrl: '',
      path: '/procurement/requests',
      user: { id: 'u' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Nonce validation failed/);
  });

  it('swallows cleanup DELETE failures without failing the request', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    dataSource.query
      .mockResolvedValueOnce([]) // SELECT
      .mockResolvedValueOnce(undefined) // INSERT
      .mockRejectedValueOnce(new Error('cleanup fail')); // DELETE
    const ctx = makeCtx({
      method: 'POST',
      headers: { 'x-nonce': 'n4', 'x-timestamp': String(Date.now()) },
      baseUrl: '',
      path: '/procurement/requests',
      user: { id: 'u' },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
