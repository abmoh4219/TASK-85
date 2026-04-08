import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerGenerateKeyFunction, ThrottlerGetTrackerFunction, ThrottlerOptions } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AnomalyEvent, AnomalyEventType, AnomalyEventStatus } from '../../modules/notifications/anomaly-event.entity';

/** HTTP methods classified as sensitive (write operations). */
const SENSITIVE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AnomalyThrottlerGuard extends ThrottlerGuard {
  @InjectRepository(AnomalyEvent)
  private readonly anomalyRepo: Repository<AnomalyEvent>;

  /** Track by authenticated user ID when available, fall back to IP. */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ?? req.ip ?? req.socket?.remoteAddress ?? 'anonymous';
  }

  /**
   * Override handleRequest to enforce the "sensitive" throttler on ALL write
   * operations (POST/PATCH/PUT/DELETE), whether authenticated or not.
   * Unauthenticated writes (e.g. /auth/login) are tracked by IP.
   * Non-write requests (GET) skip the sensitive bucket entirely.
   */
  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: ThrottlerOptions,
    getTracker: ThrottlerGetTrackerFunction,
    generateKey: ThrottlerGenerateKeyFunction,
  ): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const isSensitiveMethod = SENSITIVE_METHODS.has(req.method);

    // For the "sensitive" named throttler: only enforce on write operations
    if (throttler.name === 'sensitive' && !isSensitiveMethod) {
      return true; // skip — GET/HEAD/OPTIONS are not sensitive actions
    }

    return super.handleRequest(context, limit, ttl, throttler, getTracker, generateKey);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throttlerLimitDetail?: any,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id?: string } | undefined;

    // Fire-and-forget: record anomaly event asynchronously
    this.anomalyRepo.save(
      this.anomalyRepo.create({
        userId: user?.id ?? null,
        type: AnomalyEventType.RATE_LIMIT_EXCEEDED,
        status: AnomalyEventStatus.PENDING,
        description: `Rate limit exceeded by ${user?.id ?? 'anonymous'} on ${req.method} ${req.path}`,
        ipAddress: (req.ip ?? req.socket?.remoteAddress ?? null),
        requestPath: req.path,
        metadata: { method: req.method, path: req.path },
      }),
    ).catch(() => { /* swallow — don't block the 429 response */ });

    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
