import { LearningService } from '../learning.service';
import { LearningPlanStatus } from '../learning-plan.entity';

describe('LearningService — lifecycle transition validation', () => {
  const isValid = LearningService.prototype.isValidPlanTransition;

  describe('isValidPlanTransition', () => {
    it('allows not_started → active', () => {
      expect(isValid(LearningPlanStatus.NOT_STARTED, LearningPlanStatus.ACTIVE)).toBe(true);
    });

    it('rejects not_started → paused (must activate first)', () => {
      expect(isValid(LearningPlanStatus.NOT_STARTED, LearningPlanStatus.PAUSED)).toBe(false);
    });

    it('rejects not_started → completed (must activate first)', () => {
      expect(isValid(LearningPlanStatus.NOT_STARTED, LearningPlanStatus.COMPLETED)).toBe(false);
    });

    it('allows active → paused', () => {
      expect(isValid(LearningPlanStatus.ACTIVE, LearningPlanStatus.PAUSED)).toBe(true);
    });

    it('allows active → completed', () => {
      expect(isValid(LearningPlanStatus.ACTIVE, LearningPlanStatus.COMPLETED)).toBe(true);
    });

    it('rejects active → archived (must complete or pause first)', () => {
      expect(isValid(LearningPlanStatus.ACTIVE, LearningPlanStatus.ARCHIVED)).toBe(false);
    });

    it('allows paused → active (resume)', () => {
      expect(isValid(LearningPlanStatus.PAUSED, LearningPlanStatus.ACTIVE)).toBe(true);
    });

    it('allows paused → archived', () => {
      expect(isValid(LearningPlanStatus.PAUSED, LearningPlanStatus.ARCHIVED)).toBe(true);
    });

    it('allows completed → archived', () => {
      expect(isValid(LearningPlanStatus.COMPLETED, LearningPlanStatus.ARCHIVED)).toBe(true);
    });

    it('rejects completed → active (cannot reactivate completed plan)', () => {
      expect(isValid(LearningPlanStatus.COMPLETED, LearningPlanStatus.ACTIVE)).toBe(false);
    });

    it('rejects archived → any (terminal state)', () => {
      expect(isValid(LearningPlanStatus.ARCHIVED, LearningPlanStatus.ACTIVE)).toBe(false);
      expect(isValid(LearningPlanStatus.ARCHIVED, LearningPlanStatus.NOT_STARTED)).toBe(false);
    });
  });
});
