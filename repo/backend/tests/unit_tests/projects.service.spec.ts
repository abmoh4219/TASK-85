import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../../src/modules/projects/projects.service';
import { Project, ProjectStatus } from '../../src/modules/projects/project.entity';
import { ProjectTask, TaskStatus } from '../../src/modules/projects/project-task.entity';
import { Milestone } from '../../src/modules/projects/milestone.entity';
import { Deliverable } from '../../src/modules/projects/deliverable.entity';
import { AcceptanceScore } from '../../src/modules/projects/acceptance-score.entity';
import { UserRole } from '../../src/modules/users/user.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';

const makeQb = (rows: any[] = []) => ({
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
});

const mockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'id-1', ...d })),
  createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
});

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepo: ReturnType<typeof mockRepo>;
  let taskRepo: ReturnType<typeof mockRepo>;
  let milestoneRepo: ReturnType<typeof mockRepo>;
  let deliverableRepo: ReturnType<typeof mockRepo>;
  let scoreRepo: ReturnType<typeof mockRepo>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    projectRepo = mockRepo();
    taskRepo = mockRepo();
    milestoneRepo = mockRepo();
    deliverableRepo = mockRepo();
    scoreRepo = mockRepo();
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(ProjectTask), useValue: taskRepo },
        { provide: getRepositoryToken(Milestone), useValue: milestoneRepo },
        { provide: getRepositoryToken(Deliverable), useValue: deliverableRepo },
        { provide: getRepositoryToken(AcceptanceScore), useValue: scoreRepo },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  describe('pure transitions', () => {
    it('isValidProjectTransition', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INITIATION, ProjectStatus.INSPECTION)).toBe(true);
      expect(service.isValidProjectTransition(ProjectStatus.ARCHIVE, ProjectStatus.INITIATION)).toBe(false);
    });

    it('isValidTaskTransition', () => {
      expect(service.isValidTaskTransition(TaskStatus.PENDING, TaskStatus.IN_PROGRESS)).toBe(true);
      expect(service.isValidTaskTransition(TaskStatus.APPROVED, TaskStatus.IN_PROGRESS)).toBe(false);
      expect(service.isValidTaskTransition(TaskStatus.REJECTED, TaskStatus.IN_PROGRESS)).toBe(true);
    });
  });

  describe('projects', () => {
    it('createProject persists and logs', async () => {
      await service.createProject({
        title: 'p', startDate: new Date().toISOString(), endDate: new Date().toISOString(),
      } as any, 'u1');
      expect(projectRepo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
    });

    it('createProject with null dates', async () => {
      await service.createProject({ title: 'p' } as any, 'u1');
      expect(projectRepo.save).toHaveBeenCalled();
    });

    it('getProjects uses query builder for employee', async () => {
      const qb = makeQb([{ id: 'p1' }]);
      projectRepo.createQueryBuilder.mockReturnValue(qb);
      const res = await service.getProjects({ id: 'u1', role: UserRole.EMPLOYEE });
      expect(res).toHaveLength(1);
      expect(qb.where).toHaveBeenCalled();
    });

    it('getProjects returns all for admin', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      const res = await service.getProjects({ id: 'u1', role: UserRole.ADMIN });
      expect(res).toHaveLength(1);
    });

    it('getProject throws when missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.getProject('x')).rejects.toThrow(NotFoundException);
    });

    it('getProject forbids employee not owner or assigned', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', ownerId: 'other', tasks: [] });
      await expect(service.getProject('p1', { id: 'u1', role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
    });

    it('getProject allows employee who is assigned', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', ownerId: 'other', tasks: [{ assignedToId: 'u1' }] });
      const res = await service.getProject('p1', { id: 'u1', role: UserRole.EMPLOYEE });
      expect(res).toBeDefined();
    });

    it('getProject allows owner', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', ownerId: 'u1', tasks: [] });
      const res = await service.getProject('p1', { id: 'u1', role: UserRole.EMPLOYEE });
      expect(res).toBeDefined();
    });

    it('advanceProjectStatus valid', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', status: ProjectStatus.INITIATION });
      const res = await service.advanceProjectStatus('p1', ProjectStatus.INSPECTION, 'u1');
      expect(res.status).toBe(ProjectStatus.INSPECTION);
    });

    it('advanceProjectStatus invalid', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', status: ProjectStatus.ARCHIVE });
      await expect(
        service.advanceProjectStatus('p1', ProjectStatus.INITIATION, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('advanceProjectStatus throws when missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.advanceProjectStatus('x', ProjectStatus.INSPECTION, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('tasks', () => {
    it('createTask persists', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1' });
      await service.createTask('p1', { title: 't', assignedToId: 'u2', dueDate: new Date().toISOString() } as any, 'u1');
      expect(taskRepo.save).toHaveBeenCalled();
    });

    it('createTask throws when project missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.createTask('x', { title: 't' } as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('getTasks allows admin', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', ownerId: 'other', tasks: [] });
      taskRepo.find.mockResolvedValue([{ id: 't1' }]);
      const res = await service.getTasks('p1', { id: 'u1', role: UserRole.ADMIN });
      expect(res).toHaveLength(1);
    });

    it('getTasks forbids employee with no access', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1', ownerId: 'other', tasks: [] });
      await expect(service.getTasks('p1', { id: 'u1', role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
    });

    it('getTasks throws when project missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.getTasks('x')).rejects.toThrow(NotFoundException);
    });

    it('advanceTaskStatus valid by employee assignee', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', status: TaskStatus.PENDING, assignedToId: 'u1' });
      const res = await service.advanceTaskStatus('p1', 't1', TaskStatus.IN_PROGRESS, 'u1', UserRole.EMPLOYEE);
      expect(res.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('advanceTaskStatus forbids non-assigned employee', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', status: TaskStatus.PENDING, assignedToId: 'other', createdById: 'other' });
      await expect(
        service.advanceTaskStatus('p1', 't1', TaskStatus.IN_PROGRESS, 'u1', UserRole.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('advanceTaskStatus forbids employee approving', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', status: TaskStatus.SUBMITTED, assignedToId: 'u1' });
      await expect(
        service.advanceTaskStatus('p1', 't1', TaskStatus.APPROVED, 'u1', UserRole.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('advanceTaskStatus rejects invalid transition', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', status: TaskStatus.APPROVED, assignedToId: 'u1' });
      await expect(
        service.advanceTaskStatus('p1', 't1', TaskStatus.IN_PROGRESS, 'u1', UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('advanceTaskStatus throws when missing', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(
        service.advanceTaskStatus('p1', 'x', TaskStatus.IN_PROGRESS, 'u1', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('advanceTaskStatus admin approves', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', status: TaskStatus.SUBMITTED, assignedToId: 'u2' });
      const res = await service.advanceTaskStatus('p1', 't1', TaskStatus.APPROVED, 'u1', UserRole.ADMIN);
      expect(res.status).toBe(TaskStatus.APPROVED);
    });
  });

  describe('milestones', () => {
    it('createMilestone throws when project missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.createMilestone('x', { title: 'm' } as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('createMilestone persists', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1' });
      await service.createMilestone('p1', { title: 'm', dueDate: new Date().toISOString() } as any, 'u1');
      expect(milestoneRepo.save).toHaveBeenCalled();
    });

    it('getMilestones', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1' });
      milestoneRepo.find.mockResolvedValue([{ id: 'm1' }]);
      const res = await service.getMilestones('p1');
      expect(res).toHaveLength(1);
    });

    it('getMilestones throws when project missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.getMilestones('x')).rejects.toThrow(NotFoundException);
    });

    it('updateMilestone updates progress to 100 sets completedAt', async () => {
      milestoneRepo.findOne.mockResolvedValue({ id: 'm1', projectId: 'p1', progressPercent: 50, completedAt: null });
      const res = await service.updateMilestone('p1', 'm1', { progressPercent: 100 } as any, 'u1');
      expect(res.completedAt).toBeDefined();
    });

    it('updateMilestone updates title and lesser progress', async () => {
      milestoneRepo.findOne.mockResolvedValue({ id: 'm1', projectId: 'p1', progressPercent: 20, completedAt: null });
      await service.updateMilestone('p1', 'm1', { title: 'new', progressPercent: 50 } as any, 'u1');
      expect(milestoneRepo.save).toHaveBeenCalled();
    });

    it('updateMilestone throws when missing', async () => {
      milestoneRepo.findOne.mockResolvedValue(null);
      await expect(service.updateMilestone('p1', 'x', {} as any, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deliverables', () => {
    it('submitDeliverable happy path auto-advances IN_PROGRESS', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', assignedToId: 'u1', status: TaskStatus.IN_PROGRESS });
      const res = await service.submitDeliverable('p1', 't1', { title: 'd' } as any, 'u1', UserRole.EMPLOYEE);
      expect(res).toBeDefined();
      expect(taskRepo.save).toHaveBeenCalled();
    });

    it('submitDeliverable forbids non-assigned employee', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', projectId: 'p1', assignedToId: 'other', createdById: 'other', status: TaskStatus.PENDING });
      await expect(
        service.submitDeliverable('p1', 't1', { title: 'd' } as any, 'u1', UserRole.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('submitDeliverable throws when task missing', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.submitDeliverable('p1', 'x', {} as any, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('scoring', () => {
    it('scoreAcceptance persists', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1' });
      await service.scoreAcceptance('p1', { score: 90 } as any, 'u1');
      expect(scoreRepo.save).toHaveBeenCalled();
    });

    it('scoreAcceptance throws when project missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.scoreAcceptance('x', { score: 90 } as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('getAcceptanceScores returns rows', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 'p1' });
      scoreRepo.find.mockResolvedValue([{ id: 's1' }]);
      const res = await service.getAcceptanceScores('p1');
      expect(res).toHaveLength(1);
    });

    it('getAcceptanceScores throws when project missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.getAcceptanceScores('x')).rejects.toThrow(NotFoundException);
    });
  });
});
