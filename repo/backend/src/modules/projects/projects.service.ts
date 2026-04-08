import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from './project.entity';
import { ProjectTask, TaskStatus } from './project-task.entity';
import { Milestone } from './milestone.entity';
import { Deliverable } from './deliverable.entity';
import { AcceptanceScore } from './acceptance-score.entity';
import { UserRole } from '../users/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/create-milestone.dto';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';
import { AcceptanceScoreDto } from './dto/acceptance-score.dto';

// Valid project status transitions — cannot skip stages
const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.INITIATION]:      [ProjectStatus.CHANGE, ProjectStatus.INSPECTION],
  [ProjectStatus.CHANGE]:          [ProjectStatus.INSPECTION],
  [ProjectStatus.INSPECTION]:      [ProjectStatus.FINAL_ACCEPTANCE],
  [ProjectStatus.FINAL_ACCEPTANCE]: [ProjectStatus.ARCHIVE],
  [ProjectStatus.ARCHIVE]:         [],
};

// Valid task status transitions
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]:     [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.SUBMITTED],
  [TaskStatus.SUBMITTED]:   [TaskStatus.APPROVED, TaskStatus.REJECTED],
  [TaskStatus.APPROVED]:    [],
  [TaskStatus.REJECTED]:    [TaskStatus.IN_PROGRESS],
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectTask) private readonly taskRepo: Repository<ProjectTask>,
    @InjectRepository(Milestone) private readonly milestoneRepo: Repository<Milestone>,
    @InjectRepository(Deliverable) private readonly deliverableRepo: Repository<Deliverable>,
    @InjectRepository(AcceptanceScore) private readonly scoreRepo: Repository<AcceptanceScore>,
    private readonly auditLog: AuditLogService,
  ) {}

  // ── Projects ──────────────────────────────────────────────────────────────

  async createProject(dto: CreateProjectDto, userId: string): Promise<Project> {
    const project = this.projectRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      ownerId: userId,
      status: ProjectStatus.INITIATION,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
    });
    await this.projectRepo.save(project);
    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'Project', entityId: project.id,
      after: { title: dto.title, status: ProjectStatus.INITIATION },
    });
    return project;
  }

  async getProjects(user: { id: string; role: UserRole }): Promise<Project[]> {
    // Employees see projects they own or are assigned tasks in
    if (user.role === UserRole.EMPLOYEE) {
      return this.projectRepo
        .createQueryBuilder('p')
        .leftJoin('p.tasks', 't')
        .where('p.owner_id = :uid OR t.assigned_to_id = :uid', { uid: user.id })
        .orderBy('p.created_at', 'DESC')
        .getMany();
    }
    return this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getProject(id: string, user?: { id: string; role: UserRole }): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['tasks', 'tasks.deliverables', 'milestones'],
    });
    if (!project) throw new NotFoundException('Project not found');
    // Object-level authorization: employees can only see projects they own or are assigned to
    if (user && user.role === UserRole.EMPLOYEE) {
      const isOwner = project.ownerId === user.id;
      const isAssigned = project.tasks?.some((t) => t.assignedToId === user.id);
      if (!isOwner && !isAssigned) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }
    return project;
  }

  async advanceProjectStatus(
    id: string,
    targetStatus: ProjectStatus,
    userId: string,
  ): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    const allowed = PROJECT_TRANSITIONS[project.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition project from ${project.status} to ${targetStatus}. Allowed next: ${allowed.join(', ') || 'none'}`,
      );
    }

    const before = { status: project.status };
    project.status = targetStatus;
    await this.projectRepo.save(project);
    await this.auditLog.log({
      userId, action: 'STATUS_CHANGE', entityType: 'Project', entityId: id,
      before, after: { status: targetStatus },
    });
    return project;
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async createTask(projectId: string, dto: CreateTaskDto, userId: string): Promise<ProjectTask> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const task = this.taskRepo.create({
      projectId,
      title: dto.title,
      description: dto.description ?? null,
      assignedToId: dto.assignedToId ?? null,
      createdById: userId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: TaskStatus.PENDING,
    });
    await this.taskRepo.save(task);
    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'ProjectTask', entityId: task.id,
      after: { title: dto.title, projectId },
    });
    return task;
  }

  async getTasks(projectId: string, user?: { id: string; role: UserRole }): Promise<ProjectTask[]> {
    const project = await this.projectRepo.findOne({ where: { id: projectId }, relations: ['tasks'] });
    if (!project) throw new NotFoundException('Project not found');
    if (user && user.role === UserRole.EMPLOYEE) {
      const isOwner = project.ownerId === user.id;
      const isAssigned = project.tasks?.some((t) => t.assignedToId === user.id);
      if (!isOwner && !isAssigned) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }
    return this.taskRepo.find({
      where: { projectId },
      relations: ['deliverables'],
      order: { createdAt: 'DESC' },
    });
  }

  async advanceTaskStatus(
    projectId: string,
    taskId: string,
    targetStatus: TaskStatus,
    userId: string,
    userRole: UserRole,
  ): Promise<ProjectTask> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Task not found');

    // Object-level auth: employees can only advance their own assigned tasks
    if (userRole === UserRole.EMPLOYEE) {
      if (task.assignedToId !== userId && task.createdById !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }
    }

    // Only admins/supervisors can approve or reject
    if (
      [TaskStatus.APPROVED, TaskStatus.REJECTED].includes(targetStatus) &&
      ![UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole)
    ) {
      throw new ForbiddenException('Only admins and supervisors can approve or reject tasks');
    }

    const allowed = TASK_TRANSITIONS[task.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition task from ${task.status} to ${targetStatus}`,
      );
    }

    const before = { status: task.status };
    task.status = targetStatus;
    await this.taskRepo.save(task);
    await this.auditLog.log({
      userId, action: 'STATUS_CHANGE', entityType: 'ProjectTask', entityId: taskId,
      before, after: { status: targetStatus },
    });
    return task;
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async createMilestone(projectId: string, dto: CreateMilestoneDto, userId: string): Promise<Milestone> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const milestone = this.milestoneRepo.create({
      projectId,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      progressPercent: 0,
    });
    await this.milestoneRepo.save(milestone);
    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'Milestone', entityId: milestone.id,
      after: { title: dto.title, projectId },
    });
    return milestone;
  }

  async getMilestones(projectId: string): Promise<Milestone[]> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return this.milestoneRepo.find({ where: { projectId }, order: { dueDate: 'ASC' } });
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    userId: string,
  ): Promise<Milestone> {
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, projectId } });
    if (!milestone) throw new NotFoundException('Milestone not found');

    const before = { progressPercent: milestone.progressPercent };
    if (dto.title !== undefined) milestone.title = dto.title;
    if (dto.progressPercent !== undefined) {
      milestone.progressPercent = dto.progressPercent;
      if (dto.progressPercent === 100 && !milestone.completedAt) {
        milestone.completedAt = new Date();
      }
    }
    await this.milestoneRepo.save(milestone);
    await this.auditLog.log({
      userId, action: 'UPDATE', entityType: 'Milestone', entityId: milestoneId,
      before, after: dto as Record<string, unknown>,
    });
    return milestone;
  }

  // ── Deliverables ──────────────────────────────────────────────────────────

  async submitDeliverable(
    projectId: string,
    taskId: string,
    dto: SubmitDeliverableDto,
    userId: string,
    userRole?: UserRole,
  ): Promise<Deliverable> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Task not found');

    // Object-level auth: employees can only submit deliverables for their own tasks
    if (userRole === UserRole.EMPLOYEE) {
      if (task.assignedToId !== userId && task.createdById !== userId) {
        throw new ForbiddenException('You are not assigned to this task');
      }
    }

    const deliverable = this.deliverableRepo.create({
      taskId,
      submittedById: userId,
      title: dto.title,
      description: dto.description ?? null,
      fileUrl: dto.fileUrl ?? null,
    });
    await this.deliverableRepo.save(deliverable);

    // Auto-advance task to submitted if in-progress
    if (task.status === TaskStatus.IN_PROGRESS) {
      task.status = TaskStatus.SUBMITTED;
      await this.taskRepo.save(task);
    }

    await this.auditLog.log({
      userId, action: 'SUBMIT_DELIVERABLE', entityType: 'Deliverable', entityId: deliverable.id,
      after: { title: dto.title, taskId },
    });
    return deliverable;
  }

  // ── Acceptance Scoring ────────────────────────────────────────────────────

  async scoreAcceptance(projectId: string, dto: AcceptanceScoreDto, userId: string): Promise<AcceptanceScore> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const score = this.scoreRepo.create({
      projectId,
      scoredById: userId,
      deliverableId: dto.deliverableId ?? null,
      score: dto.score,
      maxScore: dto.maxScore ?? 100,
      feedback: dto.feedback ?? null,
    });
    await this.scoreRepo.save(score);
    await this.auditLog.log({
      userId, action: 'SCORE', entityType: 'AcceptanceScore', entityId: score.id,
      after: { projectId, score: dto.score, maxScore: dto.maxScore ?? 100 },
    });
    return score;
  }

  async getAcceptanceScores(projectId: string): Promise<AcceptanceScore[]> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return this.scoreRepo.find({ where: { projectId }, order: { createdAt: 'DESC' } });
  }

  // ── Helpers for unit tests ────────────────────────────────────────────────

  isValidProjectTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    return PROJECT_TRANSITIONS[from].includes(to);
  }

  isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
    return TASK_TRANSITIONS[from].includes(to);
  }
}
