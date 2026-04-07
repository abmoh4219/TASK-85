import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Paths exempt from nonce REQUIREMENT (nonce is optional but still validated if present)
const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/health',
];

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

    // Check if this path is exempt from the nonce requirement
    const requestPath = req.baseUrl + req.path;
    const isExempt = EXEMPT_PATHS.some((p) => requestPath.startsWith(p));

    // If headers are missing: exempt paths pass through, others are rejected
    if (!nonce || !timestamp) {
      if (isExempt) {
        return next();
      }
      throw new BadRequestException(
        'Missing required X-Nonce and X-Timestamp headers for write operations',
      );
    }

    // If headers ARE present, always validate them (even on exempt paths)
    const ts = parseInt(timestamp, 10);
    const now = Date.now();

    if (isNaN(ts) || Math.abs(now - ts) > NONCE_WINDOW_MS) {
      throw new BadRequestException('Request timestamp out of acceptable range (\u00b15 min)');
    }

    if (this.usedNonces.has(nonce)) {
      throw new BadRequestException('Duplicate nonce \u2014 request already processed');
    }

    this.usedNonces.set(nonce, now);
    // Cleanup stale nonces
    for (const [n, time] of this.usedNonces) {
      if (now - time > NONCE_WINDOW_MS) this.usedNonces.delete(n);
    }

    next();
  }
}
