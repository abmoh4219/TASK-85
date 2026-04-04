import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AnomalyEvent, AnomalyEventType, AnomalyEventStatus } from '../../modules/notifications/anomaly-event.entity';

@Injectable()
export class AnomalyThrottlerGuard extends ThrottlerGuard {
  @InjectRepository(AnomalyEvent)
  private readonly anomalyRepo: Repository<AnomalyEvent>;

  /** Track by user ID when authenticated, fall back to IP. Fulfils "per user" rate limit requirement. */
  protected async getTracker(req: Request): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ?? req.ip ?? req.socket?.remoteAddress ?? 'anonymous';
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
