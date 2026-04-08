import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Request, Response, NextFunction } from 'express';

const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Paths exempt from nonce REQUIREMENT (nonce is optional but still validated if present)
const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/health',
];

/**
 * Extract user ID from JWT token in Authorization header without full auth flow.
 * This allows user-scoped nonce protection even though middleware runs before guards.
 */
function extractUserIdFromToken(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.split(' ')[1];
    // Decode JWT payload (base64url) without verification — just to get the sub claim
    // Actual verification happens in JwtAuthGuard later
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'),
    );
    return payload.sub ?? payload.id ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class NonceMiddleware implements NestMiddleware {
  constructor(private readonly dataSource: DataSource) {}

  async use(req: Request, _res: Response, next: NextFunction) {
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

    // User-scoped nonce: extract user ID from JWT token (pre-auth phase)
    const userId = extractUserIdFromToken(req);

    // Check for duplicate nonce in DB (scoped by user)
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

    next();
  }
}
