import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { AnomalyThrottlerGuard } from '../../src/common/guards/anomaly-throttler.guard';

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

function createGuard(): {
  guard: AnomalyThrottlerGuard;
  anomalyRepo: { create: jest.Mock; save: jest.Mock };
} {
  const options = { throttlers: [] } as any;
  const storage = { getRecord: jest.fn(), addRecord: jest.fn() } as any;
  const reflector = new Reflector();
  const guard = new AnomalyThrottlerGuard(options, storage, reflector);
  const anomalyRepo = {
    create: jest.fn((x) => x),
    save: jest.fn().mockResolvedValue(undefined),
  };
  // Inject the repo (property injection in the guard)
  (guard as any).anomalyRepo = anomalyRepo;
  return { guard, anomalyRepo };
}

describe('AnomalyThrottlerGuard', () => {
  describe('getTracker', () => {
    it('returns user id when user is present', async () => {
      const { guard } = createGuard();
      const result = await (guard as any).getTracker({ user: { id: 'u-1' }, ip: '127.0.0.1' });
      expect(result).toBe('u-1');
    });

    it('falls back to req.ip when no user id', async () => {
      const { guard } = createGuard();
      const result = await (guard as any).getTracker({ ip: '10.0.0.1' });
      expect(result).toBe('10.0.0.1');
    });

    it('falls back to socket.remoteAddress when no ip', async () => {
      const { guard } = createGuard();
      const result = await (guard as any).getTracker({
        socket: { remoteAddress: '192.168.1.1' },
      });
      expect(result).toBe('192.168.1.1');
    });

    it('returns "anonymous" when no info is available', async () => {
      const { guard } = createGuard();
      const result = await (guard as any).getTracker({});
      expect(result).toBe('anonymous');
    });
  });

  describe('handleRequest', () => {
    it('skips when throttler "sensitive" hits a GET request', async () => {
      const { guard } = createGuard();
      const superSpy = jest
        .spyOn(ThrottlerGuard.prototype as any, 'handleRequest')
        .mockResolvedValue(true);
      const ctx = makeCtx({ method: 'GET' });
      const result = await (guard as any).handleRequest(
        ctx,
        10,
        60,
        { name: 'sensitive' },
        async () => 'tracker',
        () => 'key',
      );
      expect(result).toBe(true);
      expect(superSpy).not.toHaveBeenCalled();
      superSpy.mockRestore();
    });

    it('delegates to super for POST on sensitive throttler', async () => {
      const { guard } = createGuard();
      const superSpy = jest
        .spyOn(ThrottlerGuard.prototype as any, 'handleRequest')
        .mockResolvedValue(true);
      const ctx = makeCtx({ method: 'POST' });
      const result = await (guard as any).handleRequest(
        ctx,
        10,
        60,
        { name: 'sensitive' },
        async () => 'tracker',
        () => 'key',
      );
      expect(result).toBe(true);
      expect(superSpy).toHaveBeenCalledTimes(1);
      superSpy.mockRestore();
    });

    it('delegates to super for non-sensitive throttlers regardless of method', async () => {
      const { guard } = createGuard();
      const superSpy = jest
        .spyOn(ThrottlerGuard.prototype as any, 'handleRequest')
        .mockResolvedValue(true);
      const ctx = makeCtx({ method: 'GET' });
      const result = await (guard as any).handleRequest(
        ctx,
        10,
        60,
        { name: 'default' },
        async () => 'tracker',
        () => 'key',
      );
      expect(result).toBe(true);
      expect(superSpy).toHaveBeenCalledTimes(1);
      superSpy.mockRestore();
    });
  });

  describe('throwThrottlingException', () => {
    it('records an anomaly event and delegates to super', async () => {
      const { guard, anomalyRepo } = createGuard();
      const superSpy = jest
        .spyOn(ThrottlerGuard.prototype as any, 'throwThrottlingException')
        .mockResolvedValue(undefined);
      const ctx = makeCtx({
        method: 'POST',
        path: '/procurement/requests',
        ip: '127.0.0.1',
        user: { id: 'u-42' },
      });
      await (guard as any).throwThrottlingException(ctx, {});
      expect(anomalyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-42',
          requestPath: '/procurement/requests',
        }),
      );
      expect(anomalyRepo.save).toHaveBeenCalled();
      expect(superSpy).toHaveBeenCalled();
      superSpy.mockRestore();
    });

    it('records with null userId / socket fallback ip when unauthenticated', async () => {
      const { guard, anomalyRepo } = createGuard();
      const superSpy = jest
        .spyOn(ThrottlerGuard.prototype as any, 'throwThrottlingException')
        .mockResolvedValue(undefined);
      const ctx = makeCtx({
        method: 'POST',
        path: '/auth/login',
        socket: { remoteAddress: '10.0.0.5' },
      });
      await (guard as any).throwThrottlingException(ctx);
      expect(anomalyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          ipAddress: '10.0.0.5',
        }),
      );
      superSpy.mockRestore();
    });

    it('swallows repository save errors', async () => {
      const { guard, anomalyRepo } = createGuard();
      anomalyRepo.save.mockRejectedValueOnce(new Error('db fail'));
      const superSpy = jest
        .spyOn(ThrottlerGuard.prototype as any, 'throwThrottlingException')
        .mockResolvedValue(undefined);
      const ctx = makeCtx({ method: 'POST', path: '/x', ip: '1.2.3.4' });
      await expect((guard as any).throwThrottlingException(ctx)).resolves.toBeUndefined();
      superSpy.mockRestore();
      // allow unhandled rejection handler to settle
      await new Promise((r) => setImmediate(r));
    });
  });
});
