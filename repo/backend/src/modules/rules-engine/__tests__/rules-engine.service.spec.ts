import { RulesEngineService } from '../rules-engine.service';

describe('RulesEngineService — conflict detection & rollback timing', () => {
  const service = {
    detectConflict: RulesEngineService.prototype.detectConflict,
    isRollbackWithinTimeLimit: RulesEngineService.prototype.isRollbackWithinTimeLimit,
  };

  describe('detectConflict', () => {
    const active = [
      { name: 'Max PO Value', category: 'procurement_threshold', definition: { threshold: 5000 } },
      { name: 'Net 30 Terms', category: 'pricing', definition: { terms: 30 } },
    ];

    it('detects duplicate name as conflict', () => {
      const result = service.detectConflict(
        { name: 'Max PO Value', category: 'custom', definition: { threshold: 9999 } },
        active,
      );
      expect(result.hasConflict).toBe(true);
      expect(result.reason).toContain('Duplicate name');
    });

    it('detects duplicate threshold in same category as conflict', () => {
      const result = service.detectConflict(
        { name: 'New PO Rule', category: 'procurement_threshold', definition: { threshold: 5000 } },
        active,
      );
      expect(result.hasConflict).toBe(true);
      expect(result.reason).toContain('threshold');
    });

    it('allows same threshold in different category', () => {
      const result = service.detectConflict(
        { name: 'Inventory Threshold', category: 'inventory', definition: { threshold: 5000 } },
        active,
      );
      expect(result.hasConflict).toBe(false);
    });

    it('allows new name with different threshold in same category', () => {
      const result = service.detectConflict(
        { name: 'High PO Value', category: 'procurement_threshold', definition: { threshold: 10000 } },
        active,
      );
      expect(result.hasConflict).toBe(false);
    });

    it('returns no conflict when existing rules list is empty', () => {
      const result = service.detectConflict(
        { name: 'Any Rule', category: 'custom', definition: {} },
        [],
      );
      expect(result.hasConflict).toBe(false);
      expect(result.reason).toBeNull();
    });
  });

  describe('isRollbackWithinTimeLimit (5-minute window)', () => {
    it('returns true when rollback completes in 1 second', () => {
      expect(service.isRollbackWithinTimeLimit(1000)).toBe(true);
    });

    it('returns true when rollback completes in exactly 4 minutes 59 seconds', () => {
      expect(service.isRollbackWithinTimeLimit(4 * 60 * 1000 + 59 * 1000)).toBe(true);
    });

    it('returns false when rollback exceeds 5 minutes', () => {
      expect(service.isRollbackWithinTimeLimit(5 * 60 * 1000 + 1)).toBe(false);
    });

    it('returns false for exactly 5 minutes (boundary — must be strictly less than)', () => {
      expect(service.isRollbackWithinTimeLimit(5 * 60 * 1000)).toBe(false);
    });

    it('returns true for 0ms (instant rollback)', () => {
      expect(service.isRollbackWithinTimeLimit(0)).toBe(true);
    });
  });
});
