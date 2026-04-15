import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from '../../src/modules/admin/admin.service';
import { AdminPolicy } from '../../src/modules/admin/admin-policy.entity';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(1), // defaults already exist → skip seeding
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'p1', ...d })),
  create: jest.fn().mockImplementation((d) => d),
});

describe('AdminService', () => {
  let service: AdminService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(AdminPolicy), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  describe('getAllPolicies', () => {
    it('returns all policies ordered', async () => {
      repo.find.mockResolvedValue([{ key: 'a' }, { key: 'b' }]);
      const out = await service.getAllPolicies();
      expect(out).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({ order: { key: 'ASC' } });
    });

    it('seeds defaults when count is 0', async () => {
      repo.count.mockResolvedValue(0);
      repo.find.mockResolvedValue([]);
      await service.getAllPolicies();
      // 4 default policies inserted
      expect(repo.save).toHaveBeenCalledTimes(4);
    });
  });

  describe('getPolicy', () => {
    it('returns policy by key', async () => {
      repo.findOne.mockResolvedValue({ key: 'rate-limiting', value: { limit: 10 } });
      const out = await service.getPolicy('rate-limiting');
      expect(out.key).toBe('rate-limiting');
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getPolicy('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePolicy', () => {
    it('updates policy value and user', async () => {
      repo.findOne.mockResolvedValue({ key: 'k', value: {}, updatedById: null });
      await service.updatePolicy('k', { a: 1 }, 'user-1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ value: { a: 1 }, updatedById: 'user-1' }),
      );
    });

    it('throws NotFoundException if policy missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updatePolicy('x', {}, 'u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('canExport', () => {
    it('returns true when role scope is "all"', async () => {
      repo.findOne.mockResolvedValue({
        key: 'export-permissions',
        value: { admin: { scope: 'all' } },
      });
      expect(await service.canExport('admin', 'anything')).toBe(true);
    });

    it('returns true when role scope includes the requested scope', async () => {
      repo.findOne.mockResolvedValue({
        key: 'export-permissions',
        value: { supervisor: { scope: 'procurement,inventory' } },
      });
      expect(await service.canExport('supervisor', 'inventory')).toBe(true);
    });

    it('returns false when role scope does not include the requested scope', async () => {
      repo.findOne.mockResolvedValue({
        key: 'export-permissions',
        value: { employee: { scope: 'own-records' } },
      });
      expect(await service.canExport('employee', 'procurement')).toBe(false);
    });

    it('returns false when role not in policy', async () => {
      repo.findOne.mockResolvedValue({
        key: 'export-permissions',
        value: {},
      });
      expect(await service.canExport('ghost', 'x')).toBe(false);
    });

    it('returns false when policy missing entirely', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.canExport('admin', 'x')).toBe(false);
    });
  });
});
