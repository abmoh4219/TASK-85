import {
  InventoryService,
  NEAR_EXPIRY_DAYS,
  ABNORMAL_CONSUMPTION_MULTIPLIER,
  REPLENISHMENT_BUFFER_DEFAULT,
} from '../inventory.service';

/**
 * Unit tests for InventoryService pure calculation methods.
 * No DB dependencies — these test the business logic in isolation.
 */
describe('InventoryService — alert calculations', () => {
  // We only need to test the pure methods, so we construct a minimal instance
  const service = {
    isSafetyStockBreached: InventoryService.prototype.isSafetyStockBreached,
    checkMinMax: InventoryService.prototype.checkMinMax,
    isNearExpiration: InventoryService.prototype.isNearExpiration,
    isAbnormalConsumption: InventoryService.prototype.isAbnormalConsumption,
    calculateRecommendedQuantity: InventoryService.prototype.calculateRecommendedQuantity,
  };

  describe('isSafetyStockBreached', () => {
    it('returns true when quantity is below safety stock level', () => {
      expect(service.isSafetyStockBreached(5, 10)).toBe(true);
    });

    it('returns false when quantity equals safety stock level', () => {
      expect(service.isSafetyStockBreached(10, 10)).toBe(false);
    });

    it('returns false when quantity is above safety stock level', () => {
      expect(service.isSafetyStockBreached(15, 10)).toBe(false);
    });

    it('returns false when safety stock is 0', () => {
      expect(service.isSafetyStockBreached(0, 0)).toBe(false);
    });
  });

  describe('checkMinMax', () => {
    it('returns below_min when quantity is below minimum', () => {
      expect(service.checkMinMax(3, 5, 100)).toBe('below_min');
    });

    it('returns above_max when quantity exceeds maximum', () => {
      expect(service.checkMinMax(150, 5, 100)).toBe('above_max');
    });

    it('returns null when quantity is within range', () => {
      expect(service.checkMinMax(50, 5, 100)).toBeNull();
    });

    it('returns null when quantity equals min (inclusive)', () => {
      expect(service.checkMinMax(5, 5, 100)).toBeNull();
    });

    it('returns null when maxLevel is 0 (no upper bound configured)', () => {
      expect(service.checkMinMax(500, 5, 0)).toBeNull();
    });
  });

  describe('isNearExpiration', () => {
    const now = new Date('2026-04-03T00:00:00Z');

    it('returns true when item expires within 45 days', () => {
      const expiresAt = new Date('2026-05-10T00:00:00Z'); // ~37 days
      expect(service.isNearExpiration(expiresAt, now)).toBe(true);
    });

    it('returns true when item expires exactly at the 45-day boundary', () => {
      const expiresAt = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      expect(service.isNearExpiration(expiresAt, now)).toBe(true);
    });

    it('returns false when item expires after 45 days', () => {
      const expiresAt = new Date('2026-07-01T00:00:00Z'); // ~89 days
      expect(service.isNearExpiration(expiresAt, now)).toBe(false);
    });

    it('returns false when expiresAt is null', () => {
      expect(service.isNearExpiration(null, now)).toBe(false);
    });
  });

  describe('isAbnormalConsumption (>40% above 8-week average)', () => {
    it('returns true when 7-day usage exceeds 140% of expected 7-day amount', () => {
      // avg daily = 10, expected 7-day = 70, threshold = 70 * 1.4 = 98
      expect(service.isAbnormalConsumption(100, 10)).toBe(true);
    });

    it('returns false when 7-day usage is exactly at the threshold', () => {
      // avg daily = 10, threshold = 98, usage = 98 → not >98
      expect(service.isAbnormalConsumption(98, 10)).toBe(false);
    });

    it('returns false when usage is within normal range', () => {
      expect(service.isAbnormalConsumption(50, 10)).toBe(false);
    });

    it('returns false when avgDailyUsage is 0 (no baseline)', () => {
      expect(service.isAbnormalConsumption(100, 0)).toBe(false);
    });

    it('uses the correct multiplier constant', () => {
      expect(ABNORMAL_CONSUMPTION_MULTIPLIER).toBe(1.4);
    });
  });

  describe('calculateRecommendedQuantity', () => {
    it('calculates quantity using (leadTime + buffer) * avgDailyUsage formula', () => {
      // (7 + 14) * 5 = 105
      expect(service.calculateRecommendedQuantity(7, 14, 5)).toBe(105);
    });

    it('uses default buffer of 14 days', () => {
      expect(REPLENISHMENT_BUFFER_DEFAULT).toBe(14);
    });

    it('handles zero usage (returns 0)', () => {
      expect(service.calculateRecommendedQuantity(7, 14, 0)).toBe(0);
    });

    it('handles fractional daily usage', () => {
      // (5 + 14) * 2.5 = 47.5
      expect(service.calculateRecommendedQuantity(5, 14, 2.5)).toBe(47.5);
    });
  });
});
