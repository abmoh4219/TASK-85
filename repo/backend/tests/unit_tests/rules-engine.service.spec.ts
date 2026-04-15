import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RulesEngineService } from '../../src/modules/rules-engine/rules-engine.service';
import { BusinessRule, RuleCategory, RuleStatus } from '../../src/modules/rules-engine/business-rule.entity';
import { RuleVersion } from '../../src/modules/rules-engine/rule-version.entity';
import { RuleRollout } from '../../src/modules/rules-engine/rule-rollout.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';

const mockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'id-1', ...d })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('RulesEngineService', () => {
  let service: RulesEngineService;
  let ruleRepo: ReturnType<typeof mockRepo>;
  let versionRepo: ReturnType<typeof mockRepo>;
  let rolloutRepo: ReturnType<typeof mockRepo>;
  let audit: { log: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    ruleRepo = mockRepo();
    versionRepo = mockRepo();
    rolloutRepo = mockRepo();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          update: jest.fn().mockResolvedValue({}),
          find: jest.fn().mockResolvedValue([]),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesEngineService,
        { provide: getRepositoryToken(BusinessRule), useValue: ruleRepo },
        { provide: getRepositoryToken(RuleVersion), useValue: versionRepo },
        { provide: getRepositoryToken(RuleRollout), useValue: rolloutRepo },
        { provide: AuditLogService, useValue: audit },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(RulesEngineService);
  });

  describe('pure helpers', () => {
    it('isRollbackWithinTimeLimit', () => {
      expect(service.isRollbackWithinTimeLimit(1000)).toBe(true);
      expect(service.isRollbackWithinTimeLimit(10 * 60 * 1000)).toBe(false);
    });

    it('isUserInRolloutGroup edge cases', () => {
      expect(service.isUserInRolloutGroup('u', 'r', 100)).toBe(true);
      expect(service.isUserInRolloutGroup('u', 'r', 0)).toBe(false);
      // 50% deterministic
      const a = service.isUserInRolloutGroup('u1', 'r1', 50);
      const b = service.isUserInRolloutGroup('u1', 'r1', 50);
      expect(a).toBe(b);
    });

    it('detectConflict detects duplicate name', () => {
      const res = service.detectConflict(
        { name: 'A', category: 'x', definition: {} },
        [{ name: 'A', category: 'y', definition: {} }],
      );
      expect(res.hasConflict).toBe(true);
    });

    it('detectConflict detects duplicate threshold in same category', () => {
      const res = service.detectConflict(
        { name: 'A', category: 'x', definition: { threshold: 10 } },
        [{ name: 'B', category: 'x', definition: { threshold: 10 } }],
      );
      expect(res.hasConflict).toBe(true);
    });

    it('detectConflict returns no conflict', () => {
      const res = service.detectConflict(
        { name: 'A', category: 'x', definition: { threshold: 5 } },
        [{ name: 'B', category: 'y', definition: { threshold: 10 } }],
      );
      expect(res.hasConflict).toBe(false);
    });
  });

  describe('CRUD', () => {
    it('createRule persists rule and version', async () => {
      ruleRepo.save.mockResolvedValueOnce({ id: 'r1' });
      ruleRepo.findOne.mockResolvedValueOnce({ id: 'r1' });
      await service.createRule({
        name: 'Rule', definition: { threshold: 10 }, category: RuleCategory.CUSTOM,
      } as any, 'u1');
      expect(versionRepo.save).toHaveBeenCalled();
    });

    it('createRule with defaults (no category)', async () => {
      ruleRepo.save.mockResolvedValueOnce({ id: 'r1' });
      ruleRepo.findOne.mockResolvedValueOnce({ id: 'r1' });
      await service.createRule({ name: 'R', definition: {} } as any, 'u1');
      expect(ruleRepo.save).toHaveBeenCalled();
    });

    it('getRules', async () => {
      ruleRepo.find.mockResolvedValue([{ id: 'r1' }]);
      expect(await service.getRules()).toHaveLength(1);
    });

    it('getRule happy', async () => {
      ruleRepo.findOne.mockResolvedValue({ id: 'r1' });
      expect(await service.getRule('r1')).toBeDefined();
    });

    it('getRule throws when missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.getRule('x')).rejects.toThrow(NotFoundException);
    });

    it('updateRule bumps version and reverts active to draft', async () => {
      ruleRepo.findOne
        .mockResolvedValueOnce({ id: 'r1', currentVersion: 1, status: RuleStatus.ACTIVE, name: 'old' })
        .mockResolvedValueOnce({ id: 'r1' });
      await service.updateRule('r1', {
        definition: { x: 1 }, name: 'new', description: 'd', isAbTest: true, rolloutPercentage: 50,
      } as any, 'u1');
      expect(versionRepo.save).toHaveBeenCalled();
    });

    it('updateRule without definition', async () => {
      ruleRepo.findOne
        .mockResolvedValueOnce({ id: 'r1', currentVersion: 1, status: RuleStatus.DRAFT })
        .mockResolvedValueOnce({ id: 'r1' });
      await service.updateRule('r1', { name: 'n' } as any, 'u1');
      expect(ruleRepo.save).toHaveBeenCalled();
    });

    it('updateRule throws when missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.updateRule('x', {} as any, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateConflicts', () => {
    it('detects name conflict with existing active rule', async () => {
      ruleRepo.find.mockResolvedValue([{ id: 'r2', name: 'Dup', category: RuleCategory.CUSTOM, currentVersion: 1 }]);
      const res = await service.validateConflicts({ name: 'Dup', definition: {} } as any);
      expect(res.hasConflicts).toBe(true);
    });

    it('detects threshold conflict in same category', async () => {
      ruleRepo.find.mockResolvedValue([{ id: 'r2', name: 'X', category: RuleCategory.CUSTOM, currentVersion: 1 }]);
      versionRepo.find.mockResolvedValue([{ definition: { threshold: 10 } }]);
      const res = await service.validateConflicts({
        name: 'New', definition: { threshold: 10 }, category: RuleCategory.CUSTOM,
      } as any);
      expect(res.hasConflicts).toBe(true);
    });

    it('returns no conflicts', async () => {
      ruleRepo.find.mockResolvedValue([]);
      const res = await service.validateConflicts({ name: 'New', definition: {} } as any);
      expect(res.hasConflicts).toBe(false);
    });
  });

  describe('assessImpact', () => {
    it('returns impact for A/B test', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1', currentVersion: 2, rolloutPercentage: 40, category: RuleCategory.CUSTOM,
        versions: [
          { versionNumber: 2, definition: { threshold: 20 } },
          { versionNumber: 1, definition: { threshold: 10 } },
        ],
      });
      const res = await service.assessImpact('r1');
      expect(res.estimatedImpact).toContain('A/B');
      expect(res.definitionDiff.length).toBeGreaterThan(0);
    });

    it('returns impact for full rollout', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1', currentVersion: 1, rolloutPercentage: 100, category: RuleCategory.CUSTOM,
        versions: [{ versionNumber: 1, definition: {} }],
      });
      const res = await service.assessImpact('r1');
      expect(res.estimatedImpact).toContain('Full');
      expect(res.affectedWorkflows.length).toBeGreaterThan(0);
    });

    it('throws when rule missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.assessImpact('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('stageRollout', () => {
    it('stages rule', async () => {
      ruleRepo.findOne.mockResolvedValue({ id: 'r1', status: RuleStatus.DRAFT });
      const res = await service.stageRollout('r1', 30, 'u1');
      expect(res.status).toBe(RuleStatus.STAGED);
    });

    it('throws when missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.stageRollout('x', 30, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateRule', () => {
    it('activates staged rule', async () => {
      ruleRepo.findOne.mockResolvedValue({ id: 'r1', currentVersion: 2, status: RuleStatus.STAGED });
      const res = await service.activateRule('r1', 'u1');
      expect(res.rule.status).toBe(RuleStatus.ACTIVE);
      expect(res.rollout).toBeDefined();
    });

    it('throws when already active', async () => {
      ruleRepo.findOne.mockResolvedValue({ id: 'r1', status: RuleStatus.ACTIVE });
      await expect(service.activateRule('r1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws when missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.activateRule('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('rollbackRule', () => {
    it('rolls back to previous version', async () => {
      ruleRepo.findOne
        .mockResolvedValueOnce({
          id: 'r1', currentVersion: 2, status: RuleStatus.ACTIVE,
          versions: [{ versionNumber: 1, definition: {} }, { versionNumber: 2, definition: {} }],
        })
        .mockResolvedValueOnce({ id: 'r1', currentVersion: 1 });
      const res = await service.rollbackRule('r1', 'u1');
      expect(res.restoredVersion).toBe(1);
      expect(res.completedWithinLimit).toBe(true);
    });

    it('throws when at version 1', async () => {
      ruleRepo.findOne.mockResolvedValue({ id: 'r1', currentVersion: 1, versions: [] });
      await expect(service.rollbackRule('r1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws when missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.rollbackRule('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws when previous version not found in versions list', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1', currentVersion: 3, status: RuleStatus.ACTIVE,
        versions: [{ versionNumber: 3, definition: {} }],
      });
      await expect(service.rollbackRule('r1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('evaluateRuleForUser', () => {
    it('returns active definition for non-AB rule', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1', isAbTest: false, currentVersion: 1, rolloutPercentage: 100,
        versions: [{ versionNumber: 1, definition: { x: 1 } }],
      });
      const res = await service.evaluateRuleForUser('r1', 'u1');
      expect(res.inGroup).toBe(true);
      expect(res.definition).toEqual({ x: 1 });
    });

    it('returns null for user outside rollout', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1', isAbTest: true, currentVersion: 1, rolloutPercentage: 0,
        versions: [{ versionNumber: 1, definition: {} }],
      });
      const res = await service.evaluateRuleForUser('r1', 'u1');
      expect(res.inGroup).toBe(false);
      expect(res.definition).toBeNull();
    });

    it('handles missing version', async () => {
      ruleRepo.findOne.mockResolvedValue({
        id: 'r1', isAbTest: false, currentVersion: 5, rolloutPercentage: 100, versions: [],
      });
      const res = await service.evaluateRuleForUser('r1', 'u1');
      expect(res.definition).toBeNull();
    });

    it('throws when rule missing', async () => {
      ruleRepo.findOne.mockResolvedValue(null);
      await expect(service.evaluateRuleForUser('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
