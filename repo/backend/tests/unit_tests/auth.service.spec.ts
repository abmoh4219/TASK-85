process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-1234567890abcdef';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../src/modules/auth/auth.service';
import { User, UserRole } from '../../src/modules/users/user.entity';
import { RefreshToken } from '../../src/modules/auth/refresh-token.entity';

const mockUser = (): User => ({
  id: 'user-uuid-1',
  username: 'admin',
  usernameHash: 'mock-hash',
  passwordHash: bcrypt.hashSync('meridian2024', 10),
  role: UserRole.ADMIN,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

const makeUserRepo = (user?: User | null) => ({
  findOne: jest.fn().mockResolvedValue(user ?? null),
  update: jest.fn().mockResolvedValue({}),
});

const makeTokenRepo = () => ({
  create: jest.fn().mockImplementation((d) => d),
  save: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({}),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let tokenRepo: ReturnType<typeof makeTokenRepo>;

  const build = async (expiryEnv: string = '8h') => {
    userRepo = makeUserRepo(mockUser());
    tokenRepo = makeTokenRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: tokenRepo },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('access.token.here') } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def: unknown) => {
              if (key === 'REFRESH_TOKEN_EXPIRES_IN') return expiryEnv;
              return def;
            }),
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  };

  beforeEach(async () => build());

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const result = await service.login({ username: 'admin', password: 'meridian2024' });
      expect(result.accessToken).toBe('access.token.here');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      await expect(
        service.login({ username: 'admin', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ username: 'nobody', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException for inactive user', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser(), isActive: false });
      await expect(
        service.login({ username: 'admin', password: 'meridian2024' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('rotates token and returns new tokens', async () => {
      tokenRepo.findOne.mockResolvedValue({
        id: 't1', userId: 'user-uuid-1', tokenHash: 'any',
        revokedAt: null, expiresAt: new Date(Date.now() + 60000),
      });
      const res = await service.refresh('user-uuid-1', 'raw');
      expect(res.accessToken).toBeDefined();
      expect(tokenRepo.update).toHaveBeenCalled();
    });

    it('throws when token record missing', async () => {
      tokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('user-uuid-1', 'raw')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token revoked', async () => {
      tokenRepo.findOne.mockResolvedValue({
        id: 't1', userId: 'user-uuid-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60000),
      });
      await expect(service.refresh('user-uuid-1', 'raw')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token expired and revokes all', async () => {
      tokenRepo.findOne.mockResolvedValue({
        id: 't1', userId: 'user-uuid-1', revokedAt: null, expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('user-uuid-1', 'raw')).rejects.toThrow(UnauthorizedException);
      expect(tokenRepo.update).toHaveBeenCalled();
    });

    it('throws when user not found', async () => {
      tokenRepo.findOne.mockResolvedValue({
        id: 't1', userId: 'user-uuid-1', revokedAt: null, expiresAt: new Date(Date.now() + 60000),
      });
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('user-uuid-1', 'raw')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the token', async () => {
      await service.logout('u1', 'raw');
      expect(tokenRepo.update).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('returns profile without password', async () => {
      const res = await service.getProfile('u1');
      expect((res as any).passwordHash).toBeUndefined();
    });

    it('throws when user missing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfile('x')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('parseExpiry', () => {
    it('accepts minutes', async () => {
      await build('30m');
      const res = await service.login({ username: 'admin', password: 'meridian2024' });
      expect(res.refreshToken).toBeDefined();
    });

    it('accepts days', async () => {
      await build('2d');
      const res = await service.login({ username: 'admin', password: 'meridian2024' });
      expect(res.refreshToken).toBeDefined();
    });

    it('falls back on unknown unit', async () => {
      await build('8x');
      const res = await service.login({ username: 'admin', password: 'meridian2024' });
      expect(res.refreshToken).toBeDefined();
    });
  });
});
