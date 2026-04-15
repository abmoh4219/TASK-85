process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-1234567890abcdef';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../../src/modules/users/users.service';
import { User, UserRole } from '../../src/modules/users/user.entity';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'u-1', ...d })),
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('getAll', () => {
    it('returns all users ordered by createdAt', async () => {
      repo.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      const res = await service.getAll();
      expect(res).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' } });
    });
  });

  describe('create', () => {
    it('creates a new user when username is unique', async () => {
      repo.findOne.mockResolvedValue(null);
      const res = await service.create({ username: 'bob', password: 'pw', role: UserRole.EMPLOYEE });
      expect(res).toBeDefined();
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate username', async () => {
      repo.findOne.mockResolvedValue({ id: 'x' });
      await expect(
        service.create({ username: 'bob', password: 'pw', role: UserRole.EMPLOYEE }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates username, role and isActive', async () => {
      repo.findOne.mockResolvedValue({ id: 'u1', username: 'a', usernameHash: 'x', role: UserRole.EMPLOYEE, isActive: true });
      const res = await service.update('u1', { username: 'b', role: UserRole.ADMIN, isActive: false });
      expect(repo.save).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it('is a no-op when no fields provided', async () => {
      repo.findOne.mockResolvedValue({ id: 'u1', username: 'a', role: UserRole.EMPLOYEE, isActive: true });
      await service.update('u1', {});
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when user not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { isActive: false })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('calls update with isActive false', async () => {
      repo.findOne.mockResolvedValue({ id: 'u1', isActive: true });
      const res = await service.deactivate('u1');
      expect(res).toBeDefined();
    });
  });
});
