import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { User, UserRole } from '../../users/user.entity';
import { RefreshToken } from '../refresh-token.entity';

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

const makeUserRepo = (user?: User) => ({
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

  beforeEach(async () => {
    userRepo = makeUserRepo(mockUser());
    tokenRepo = makeTokenRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: tokenRepo },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('access.token.here') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockImplementation((key: string, def: unknown) => {
            if (key === 'REFRESH_TOKEN_EXPIRES_IN') return '8h';
            return def;
          })},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

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
});
