import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearningService } from '../../src/modules/learning/learning.service';
import { LearningPlan, LearningPlanStatus } from '../../src/modules/learning/learning-plan.entity';
import { LearningGoal } from '../../src/modules/learning/learning-goal.entity';
import { StudySession } from '../../src/modules/learning/study-session.entity';
import { LearningPlanLifecycle } from '../../src/modules/learning/learning-plan-lifecycle.entity';
import { UserRole } from '../../src/modules/users/user.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';

const mockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'id-1', ...d })),
});

describe('LearningService', () => {
  let service: LearningService;
  let planRepo: ReturnType<typeof mockRepo>;
  let goalRepo: ReturnType<typeof mockRepo>;
  let sessionRepo: ReturnType<typeof mockRepo>;
  let lifecycleRepo: ReturnType<typeof mockRepo>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    planRepo = mockRepo();
    goalRepo = mockRepo();
    sessionRepo = mockRepo();
    lifecycleRepo = mockRepo();
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningService,
        { provide: getRepositoryToken(LearningPlan), useValue: planRepo },
        { provide: getRepositoryToken(LearningGoal), useValue: goalRepo },
        { provide: getRepositoryToken(StudySession), useValue: sessionRepo },
        { provide: getRepositoryToken(LearningPlanLifecycle), useValue: lifecycleRepo },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();
    service = module.get(LearningService);
  });

  describe('isValidPlanTransition', () => {
    it('validates transitions', () => {
      expect(service.isValidPlanTransition(LearningPlanStatus.NOT_STARTED, LearningPlanStatus.ACTIVE)).toBe(true);
      expect(service.isValidPlanTransition(LearningPlanStatus.ACTIVE, LearningPlanStatus.COMPLETED)).toBe(true);
      expect(service.isValidPlanTransition(LearningPlanStatus.ARCHIVED, LearningPlanStatus.ACTIVE)).toBe(false);
      expect(service.isValidPlanTransition(LearningPlanStatus.NOT_STARTED, LearningPlanStatus.ARCHIVED)).toBe(false);
    });
  });

  describe('plans', () => {
    it('createPlan persists plan and lifecycle', async () => {
      await service.createPlan({
        title: 't', userId: 'u1', startDate: new Date().toISOString(), endDate: new Date().toISOString(),
      } as any, 'creator');
      expect(planRepo.save).toHaveBeenCalled();
      expect(lifecycleRepo.save).toHaveBeenCalled();
    });

    it('createPlan with null dates', async () => {
      await service.createPlan({ title: 't', userId: 'u1' } as any, 'creator');
      expect(planRepo.save).toHaveBeenCalled();
    });

    it('getPlans filters for employee', async () => {
      await service.getPlans({ id: 'u1', role: UserRole.EMPLOYEE });
      expect(planRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' } }));
    });

    it('getPlans returns all for admin', async () => {
      await service.getPlans({ id: 'u1', role: UserRole.ADMIN });
      expect(planRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('getPlan throws when missing', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.getPlan('x')).rejects.toThrow(NotFoundException);
    });

    it('getPlan forbids other employee', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'other' });
      await expect(service.getPlan('p1', { id: 'u1', role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
    });

    it('getPlan allows owner', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'u1' });
      const res = await service.getPlan('p1', { id: 'u1', role: UserRole.EMPLOYEE });
      expect(res).toBeDefined();
    });

    it('advancePlanStatus valid', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', status: LearningPlanStatus.NOT_STARTED });
      const res = await service.advancePlanStatus('p1', LearningPlanStatus.ACTIVE, 'u1', 'go');
      expect(res.status).toBe(LearningPlanStatus.ACTIVE);
    });

    it('advancePlanStatus invalid', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', status: LearningPlanStatus.ARCHIVED });
      await expect(
        service.advancePlanStatus('p1', LearningPlanStatus.ACTIVE, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('advancePlanStatus throws when missing', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.advancePlanStatus('x', LearningPlanStatus.ACTIVE, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('getPlanLifecycle forbids employee on other', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'other' });
      await expect(
        service.getPlanLifecycle('p1', { id: 'u1', role: UserRole.EMPLOYEE }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getPlanLifecycle returns lifecycle for admin', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'x' });
      lifecycleRepo.find.mockResolvedValue([{ id: 'l1' }]);
      const res = await service.getPlanLifecycle('p1');
      expect(res).toHaveLength(1);
    });

    it('getPlanLifecycle throws when missing', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.getPlanLifecycle('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('goals', () => {
    it('createGoal persists goal', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1' });
      await service.createGoal('p1', { title: 't' } as any, 'u1');
      expect(goalRepo.save).toHaveBeenCalled();
    });

    it('createGoal throws when plan missing', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.createGoal('x', { title: 't' } as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('getGoals allows admin', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'other' });
      goalRepo.find.mockResolvedValue([{ id: 'g1' }]);
      const res = await service.getGoals('p1');
      expect(res).toHaveLength(1);
    });

    it('getGoals forbids employee on other', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'other' });
      await expect(service.getGoals('p1', { id: 'u1', role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
    });

    it('getGoals throws when plan missing', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.getGoals('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sessions', () => {
    it('logStudySession happy path', async () => {
      goalRepo.findOne.mockResolvedValue({ id: 'g1', plan: { userId: 'u1' } });
      const res = await service.logStudySession('g1', { durationMinutes: 30 } as any, 'u1', UserRole.EMPLOYEE);
      expect(sessionRepo.save).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it('logStudySession uses provided date', async () => {
      goalRepo.findOne.mockResolvedValue({ id: 'g1', plan: null });
      await service.logStudySession('g1', { sessionDate: new Date().toISOString() } as any, 'u1');
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('logStudySession forbids employee on other plan', async () => {
      goalRepo.findOne.mockResolvedValue({ id: 'g1', plan: { userId: 'other' } });
      await expect(
        service.logStudySession('g1', {} as any, 'u1', UserRole.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('logStudySession throws when goal missing', async () => {
      goalRepo.findOne.mockResolvedValue(null);
      await expect(service.logStudySession('x', {} as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('checkFrequencyCompliance below target', async () => {
      goalRepo.findOne.mockResolvedValue({ id: 'g1', sessionsPerWeek: 3, plan: null });
      sessionRepo.find.mockResolvedValue([{ id: 's1' }]);
      const res = await service.checkFrequencyCompliance('g1');
      expect(res.isBelowTarget).toBe(true);
      expect(res.compliancePercent).toBe(33);
    });

    it('checkFrequencyCompliance with null target', async () => {
      goalRepo.findOne.mockResolvedValue({ id: 'g1', sessionsPerWeek: null, plan: null });
      sessionRepo.find.mockResolvedValue([]);
      const res = await service.checkFrequencyCompliance('g1');
      expect(res.isBelowTarget).toBe(false);
      expect(res.compliancePercent).toBeNull();
    });

    it('checkFrequencyCompliance forbids employee', async () => {
      goalRepo.findOne.mockResolvedValue({ id: 'g1', sessionsPerWeek: 3, plan: { userId: 'other' } });
      await expect(
        service.checkFrequencyCompliance('g1', { id: 'u1', role: UserRole.EMPLOYEE }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('checkFrequencyCompliance throws when goal missing', async () => {
      goalRepo.findOne.mockResolvedValue(null);
      await expect(service.checkFrequencyCompliance('x')).rejects.toThrow(NotFoundException);
    });
  });
});
