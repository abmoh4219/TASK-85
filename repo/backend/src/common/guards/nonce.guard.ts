import {
  Injectable, CanActivate, ExecutionContext, BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Paths exempt from nonce REQUIREMENT (nonce is optional but still validated if present). */
const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/health',
];

/**
 * Guard that validates nonce + timestamp on sensitive write operations.
 *
 * Runs AFTER JwtAuthGuard so it uses the verified req.user context
 * for user-scoped nonce tracking — no unverified JWT decoding.
 */
@Injectable()
export class NonceGuard implements CanActivate {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // Only validate on sensitive write methods
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return true;
    }

    // Skip for public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const nonce = req.headers['x-nonce'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    // Check if this path is exempt from the nonce requirement
    const requestPath = req.baseUrl + req.path;
    const isExempt = isPublic || EXEMPT_PATHS.some((p) => requestPath.startsWith(p));

    // If headers are missing: exempt paths pass through, others are rejected
    if (!nonce || !timestamp) {
      if (isExempt) return true;
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

    // User-scoped nonce: use VERIFIED user from JwtAuthGuard (not raw JWT decode)
    const user = req.user as { id?: string } | undefined;
    const userId = user?.id ?? null;

    // Check for duplicate nonce in DB (scoped by verified user)
    try {
      const existing = await this.dataSource.query(
        `SELECT id FROM used_nonces WHERE nonce = $1 AND COALESCE(user_id, '__anon__') = COALESCE($2, '__anon__')`,
        [nonce, userId],
      );

      if (existing.length > 0) {
        throw new BadRequestException('Duplicate nonce \u2014 request already processed');
      }

      // Store nonce in DB
      await this.dataSource.query(
        `INSERT INTO used_nonces (nonce, user_id) VALUES ($1, $2)`,
        [nonce, userId],
      );

      // Async cleanup of stale nonces (older than window)
      const cutoff = new Date(now - NONCE_WINDOW_MS).toISOString();
      this.dataSource.query(
        `DELETE FROM used_nonces WHERE created_at < $1`,
        [cutoff],
      ).catch(() => { /* non-critical cleanup */ });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // If DB is unavailable, reject to fail safe
      throw new BadRequestException('Nonce validation failed');
    }

    return true;
  }
}
