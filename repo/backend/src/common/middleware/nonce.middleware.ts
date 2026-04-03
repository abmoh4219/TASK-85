import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class NonceMiddleware implements NestMiddleware {
  private readonly usedNonces = new Map<string, number>();

  use(req: Request, _res: Response, next: NextFunction) {
    // Only validate on sensitive write methods
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const nonce = req.headers['x-nonce'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!nonce || !timestamp) {
      return next(); // Not all endpoints require nonce; guards enforce where needed
    }

    const ts = parseInt(timestamp, 10);
    const now = Date.now();

    if (Math.abs(now - ts) > NONCE_WINDOW_MS) {
      throw new BadRequestException('Request timestamp out of acceptable range (±5 min)');
    }

    if (this.usedNonces.has(nonce)) {
      throw new BadRequestException('Duplicate nonce — request already processed');
    }

    this.usedNonces.set(nonce, now);
    // Cleanup stale nonces
    for (const [n, time] of this.usedNonces) {
      if (now - time > NONCE_WINDOW_MS) this.usedNonces.delete(n);
    }

    next();
  }
}
