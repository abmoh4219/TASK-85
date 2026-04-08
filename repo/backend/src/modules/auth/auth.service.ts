import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { blindIndex } from '../../common/transformers/aes.transformer';

@Injectable()
export class AuthService {
  private readonly refreshExpiresMs: number;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private readonly tokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Parse "8h" → milliseconds
    const raw = configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '8h');
    this.refreshExpiresMs = this.parseExpiry(raw);
  }

  async login(dto: LoginDto, ip?: string) {
    // Query by blind index (HMAC hash) since username column is AES-encrypted
    const usernameHash = blindIndex(dto.username);
    const user = await this.userRepo.findOne({
      where: { usernameHash },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new ForbiddenException('Account is inactive');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const accessToken = this.issueAccessToken(user);
    const { refreshToken, tokenRecord } = await this.issueRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      expiresIn: 900, // 15 min in seconds
    };
  }

  async refresh(userId: string, rawToken: string) {
    const hash = this.hashToken(rawToken);

    const record = await this.tokenRepo.findOne({
      where: { userId, tokenHash: hash },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      // Possible token reuse — revoke all tokens for user (detect theft)
      if (record && !record.revokedAt) {
        await this.tokenRepo.update({ userId }, { revokedAt: new Date() });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');

    // Rotate: revoke old, issue new
    await this.tokenRepo.update(record.id, { revokedAt: new Date() });

    const accessToken = this.issueAccessToken(user);
    const { refreshToken } = await this.issueRefreshToken(user);

    return { accessToken, refreshToken, userId: user.id, expiresIn: 900 };
  }

  async logout(userId: string, rawToken: string) {
    const hash = this.hashToken(rawToken);
    await this.tokenRepo.update({ userId, tokenHash: hash }, { revokedAt: new Date() });
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const { passwordHash: _, ...profile } = user;
    return profile;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private issueAccessToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }

  private async issueRefreshToken(user: User): Promise<{ refreshToken: string; tokenRecord: RefreshToken }> {
    const rawToken = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresMs);

    const tokenRecord = this.tokenRepo.create({ userId: user.id, tokenHash, expiresAt });
    await this.tokenRepo.save(tokenRecord);

    return { refreshToken: rawToken, tokenRecord };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 8 * 60 * 60 * 1000;
    }
  }
}
