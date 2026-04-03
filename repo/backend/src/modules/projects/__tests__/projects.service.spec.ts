import { ProjectsService } from '../projects.service';
import { ProjectStatus } from '../project.entity';
import { TaskStatus } from '../project-task.entity';

/**
 * Unit tests for ProjectsService transition validation logic.
 * Pure methods — no DB dependencies.
 */
describe('ProjectsService — status transition validation', () => {
  const service = {
    isValidProjectTransition: ProjectsService.prototype.isValidProjectTransition,
    isValidTaskTransition: ProjectsService.prototype.isValidTaskTransition,
  };

  describe('isValidProjectTransition', () => {
    it('allows initiation → change', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INITIATION, ProjectStatus.CHANGE)).toBe(true);
    });

    it('allows initiation → inspection (skip change)', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INITIATION, ProjectStatus.INSPECTION)).toBe(true);
    });

    it('allows change → inspection', () => {
      expect(service.isValidProjectTransition(ProjectStatus.CHANGE, ProjectStatus.INSPECTION)).toBe(true);
    });

    it('allows inspection → final_acceptance', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INSPECTION, ProjectStatus.FINAL_ACCEPTANCE)).toBe(true);
    });

    it('allows final_acceptance → archive', () => {
      expect(service.isValidProjectTransition(ProjectStatus.FINAL_ACCEPTANCE, ProjectStatus.ARCHIVE)).toBe(true);
    });

    it('rejects initiation → final_acceptance (skipping stages)', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INITIATION, ProjectStatus.FINAL_ACCEPTANCE)).toBe(false);
    });

    it('rejects initiation → archive (skipping all stages)', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INITIATION, ProjectStatus.ARCHIVE)).toBe(false);
    });

    it('rejects change → final_acceptance (skipping inspection)', () => {
      expect(service.isValidProjectTransition(ProjectStatus.CHANGE, ProjectStatus.FINAL_ACCEPTANCE)).toBe(false);
    });

    it('rejects archive → any status (terminal state)', () => {
      expect(service.isValidProjectTransition(ProjectStatus.ARCHIVE, ProjectStatus.INITIATION)).toBe(false);
      expect(service.isValidProjectTransition(ProjectStatus.ARCHIVE, ProjectStatus.CHANGE)).toBe(false);
    });

    it('rejects backwards transitions', () => {
      expect(service.isValidProjectTransition(ProjectStatus.INSPECTION, ProjectStatus.CHANGE)).toBe(false);
      expect(service.isValidProjectTransition(ProjectStatus.FINAL_ACCEPTANCE, ProjectStatus.INSPECTION)).toBe(false);
    });
  });

  describe('isValidTaskTransition', () => {
    it('allows pending → in_progress', () => {
      expect(service.isValidTaskTransition(TaskStatus.PENDING, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    it('allows in_progress → submitted', () => {
      expect(service.isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED)).toBe(true);
    });

    it('allows submitted → approved', () => {
      expect(service.isValidTaskTransition(TaskStatus.SUBMITTED, TaskStatus.APPROVED)).toBe(true);
    });

    it('allows submitted → rejected', () => {
      expect(service.isValidTaskTransition(TaskStatus.SUBMITTED, TaskStatus.REJECTED)).toBe(true);
    });

    it('allows rejected → in_progress (rework cycle)', () => {
      expect(service.isValidTaskTransition(TaskStatus.REJECTED, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    it('rejects pending → submitted (must go through in_progress)', () => {
      expect(service.isValidTaskTransition(TaskStatus.PENDING, TaskStatus.SUBMITTED)).toBe(false);
    });

    it('rejects approved → any (terminal state)', () => {
      expect(service.isValidTaskTransition(TaskStatus.APPROVED, TaskStatus.IN_PROGRESS)).toBe(false);
    });

    it('rejects in_progress → approved (must be submitted first)', () => {
      expect(service.isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.APPROVED)).toBe(false);
    });
  });
});
