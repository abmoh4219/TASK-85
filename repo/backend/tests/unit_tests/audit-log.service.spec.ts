import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../../src/common/services/audit-log.service';
import { AuditLog } from '../../src/modules/admin/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((d) => ({ ...d })),
      save: jest.fn().mockResolvedValue({}),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();
    service = module.get(AuditLogService);
  });

  it('creates and saves an audit entry with all params', async () => {
    await service.log({
      userId: 'u1',
      action: 'CREATE',
      entityType: 'Foo',
      entityId: 'f1',
      before: { a: 1 },
      after: { a: 2 },
      ip: '127.0.0.1',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entityType: 'Foo' }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('works with minimal params', async () => {
    await service.log({ action: 'LOGIN', entityType: 'User' });
    expect(repo.save).toHaveBeenCalled();
  });
});
