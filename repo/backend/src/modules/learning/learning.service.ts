import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { LearningPlan, LearningPlanStatus } from './learning-plan.entity';
import { LearningGoal, GoalPriority } from './learning-goal.entity';
import { StudySession } from './study-session.entity';
import { LearningPlanLifecycle } from './learning-plan-lifecycle.entity';
import { UserRole } from '../users/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { LogSessionDto } from './dto/log-session.dto';

// Valid lifecycle transitions for learning plans
const PLAN_TRANSITIONS: Record<LearningPlanStatus, LearningPlanStatus[]> = {
  [LearningPlanStatus.NOT_STARTED]: [LearningPlanStatus.ACTIVE],
  [LearningPlanStatus.ACTIVE]:      [LearningPlanStatus.PAUSED, LearningPlanStatus.COMPLETED],
  [LearningPlanStatus.PAUSED]:      [LearningPlanStatus.ACTIVE, LearningPlanStatus.ARCHIVED],
  [LearningPlanStatus.COMPLETED]:   [LearningPlanStatus.ARCHIVED],
  [LearningPlanStatus.ARCHIVED]:    [],
};

@Injectable()
export class LearningService {
  constructor(
    @InjectRepository(LearningPlan) private readonly planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningGoal) private readonly goalRepo: Repository<LearningGoal>,
    @InjectRepository(StudySession) private readonly sessionRepo: Repository<StudySession>,
    @InjectRepository(LearningPlanLifecycle) private readonly lifecycleRepo: Repository<LearningPlanLifecycle>,
    private readonly auditLog: AuditLogService,
  ) {}

  // ── Plans ─────────────────────────────────────────────────────────────────

  async createPlan(dto: CreatePlanDto, createdById: string): Promise<LearningPlan> {
    const plan = this.planRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      userId: dto.userId,
      createdById,
      status: LearningPlanStatus.NOT_STARTED,
      targetRole: dto.targetRole ?? null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });
    await this.planRepo.save(plan);

    await this.lifecycleRepo.save(
      this.lifecycleRepo.create({
        planId: plan.id,
        fromStatus: null,
        toStatus: LearningPlanStatus.NOT_STARTED,
        changedById: createdById,
        reason: 'Plan created',
      }),
    );

    await this.auditLog.log({
      userId: createdById, action: 'CREATE', entityType: 'LearningPlan', entityId: plan.id,
      after: { title: dto.title, status: LearningPlanStatus.NOT_STARTED },
    });
    return plan;
  }

  async getPlans(user: { id: string; role: UserRole }): Promise<LearningPlan[]> {
    // HR/Admin see all; employees see only their own
    const where = user.role === UserRole.EMPLOYEE ? { userId: user.id } : {};
    return this.planRepo.find({ where, relations: ['goals'], order: { createdAt: 'DESC' } });
  }

  async getPlan(id: string, user?: { id: string; role: UserRole }): Promise<LearningPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['goals', 'goals.studySessions'],
    });
    if (!plan) throw new NotFoundException('Learning plan not found');
    // Object-level authorization: employees can only see their own plans
    if (user && user.role === UserRole.EMPLOYEE && plan.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this learning plan');
    }
    return plan;
  }

  async advancePlanStatus(
    id: string, targetStatus: LearningPlanStatus, userId: string, reason?: string,
  ): Promise<LearningPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Learning plan not found');

    if (!this.isValidPlanTransition(plan.status, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition plan from ${plan.status} to ${targetStatus}. Allowed: ${PLAN_TRANSITIONS[plan.status].join(', ') || 'none'}`,
      );
    }

    const before = { status: plan.status };
    plan.status = targetStatus;
    await this.planRepo.save(plan);

    await this.lifecycleRepo.save(
      this.lifecycleRepo.create({
        planId: id,
        fromStatus: before.status,
        toStatus: targetStatus,
        changedById: userId,
        reason: reason ?? null,
      }),
    );

    await this.auditLog.log({
      userId, action: 'STATUS_CHANGE', entityType: 'LearningPlan', entityId: id,
      before, after: { status: targetStatus },
    });
    return plan;
  }

  async getPlanLifecycle(id: string): Promise<LearningPlanLifecycle[]> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Learning plan not found');
    return this.lifecycleRepo.find({ where: { planId: id }, order: { createdAt: 'ASC' } });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────

  async createGoal(planId: string, dto: CreateGoalDto, userId: string): Promise<LearningGoal> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Learning plan not found');

    const goal = this.goalRepo.create({
      planId,
      title: dto.title,
      description: dto.description ?? null,
      priority: dto.priority ?? GoalPriority.MEDIUM,
      tags: dto.tags ?? null,
      studyFrequencyRule: dto.studyFrequencyRule ?? null,
      sessionsPerWeek: dto.sessionsPerWeek ?? null,
    });
    await this.goalRepo.save(goal);
    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'LearningGoal', entityId: goal.id,
      after: { title: dto.title, planId },
    });
    return goal;
  }

  async getGoals(planId: string): Promise<LearningGoal[]> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Learning plan not found');
    return this.goalRepo.find({
      where: { planId },
      relations: ['studySessions'],
      order: { createdAt: 'DESC' },
    });
  }

  // ── Study Sessions ────────────────────────────────────────────────────────

  async logStudySession(goalId: string, dto: LogSessionDto, userId: string): Promise<StudySession> {
    const goal = await this.goalRepo.findOne({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Learning goal not found');

    const session = this.sessionRepo.create({
      goalId,
      userId,
      durationMinutes: dto.durationMinutes ?? null,
      notes: dto.notes ?? null,
      sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : new Date(),
    });
    await this.sessionRepo.save(session);
    return session;
  }

  async checkFrequencyCompliance(goalId: string): Promise<{
    goal: LearningGoal;
    sessionsThisWeek: number;
    targetSessionsPerWeek: number | null;
    isBelowTarget: boolean;
    compliancePercent: number | null;
  }> {
    const goal = await this.goalRepo.findOne({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Learning goal not found');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessions = await this.sessionRepo.find({
      where: { goalId, sessionDate: MoreThanOrEqual(sevenDaysAgo) },
    });

    const sessionsThisWeek = sessions.length;
    const target = goal.sessionsPerWeek;
    const isBelowTarget = target !== null && sessionsThisWeek < target;
    const compliancePercent =
      target && target > 0 ? Math.round((sessionsThisWeek / target) * 100) : null;

    return { goal, sessionsThisWeek, targetSessionsPerWeek: target, isBelowTarget, compliancePercent };
  }

  // ── Pure helper for unit tests ────────────────────────────────────────────

  isValidPlanTransition(from: LearningPlanStatus, to: LearningPlanStatus): boolean {
    return PLAN_TRANSITIONS[from].includes(to);
  }
}
