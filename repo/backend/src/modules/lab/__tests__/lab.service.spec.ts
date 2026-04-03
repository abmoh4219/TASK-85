import { LabService } from '../lab.service';

/**
 * Unit tests for LabService.evaluateAbnormalFlag — pure logic, no DB.
 *
 * Business rule: compare numericValue against reference range min/max and
 * critical_low/critical_high. Sets isAbnormal and isCritical flags automatically.
 */
describe('LabService — abnormal flag logic', () => {
  const evaluate = LabService.prototype.evaluateAbnormalFlag;

  const normalRange = [{ minValue: 3.5, maxValue: 5.5, criticalLow: 2.5, criticalHigh: 7.0 }];
  const noRange: never[] = [];

  describe('evaluateAbnormalFlag', () => {
    it('returns normal when value is within reference range', () => {
      const result = evaluate(4.5, normalRange);
      expect(result.isAbnormal).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('returns isAbnormal=true when value is below minimum', () => {
      const result = evaluate(3.0, normalRange); // < min 3.5
      expect(result.isAbnormal).toBe(true);
      expect(result.isCritical).toBe(false);
    });

    it('returns isAbnormal=true when value is above maximum', () => {
      const result = evaluate(6.0, normalRange); // > max 5.5
      expect(result.isAbnormal).toBe(true);
      expect(result.isCritical).toBe(false);
    });

    it('returns isCritical=true and isAbnormal=true when below critical_low', () => {
      const result = evaluate(2.0, normalRange); // < criticalLow 2.5
      expect(result.isAbnormal).toBe(true);
      expect(result.isCritical).toBe(true);
    });

    it('returns isCritical=true and isAbnormal=true when above critical_high', () => {
      const result = evaluate(8.0, normalRange); // > criticalHigh 7.0
      expect(result.isAbnormal).toBe(true);
      expect(result.isCritical).toBe(true);
    });

    it('returns normal when value equals min (inclusive)', () => {
      const result = evaluate(3.5, normalRange);
      expect(result.isAbnormal).toBe(false);
    });

    it('returns normal when value equals max (inclusive)', () => {
      const result = evaluate(5.5, normalRange);
      expect(result.isAbnormal).toBe(false);
    });

    it('returns not-abnormal when numericValue is null (no numeric result)', () => {
      const result = evaluate(null, normalRange);
      expect(result.isAbnormal).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('returns not-abnormal when no reference ranges defined', () => {
      const result = evaluate(100.0, noRange);
      expect(result.isAbnormal).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('handles range with only min (no max configured)', () => {
      const rangeMinOnly = [{ minValue: 3.5, maxValue: null, criticalLow: null, criticalHigh: null }];
      expect(evaluate(2.0, rangeMinOnly).isAbnormal).toBe(true);
      expect(evaluate(10.0, rangeMinOnly).isAbnormal).toBe(false);
    });

    it('handles range with only max (no min configured)', () => {
      const rangeMaxOnly = [{ minValue: null, maxValue: 5.5, criticalLow: null, criticalHigh: null }];
      expect(evaluate(6.0, rangeMaxOnly).isAbnormal).toBe(true);
      expect(evaluate(1.0, rangeMaxOnly).isAbnormal).toBe(false);
    });

    it('handles range with only critical thresholds', () => {
      const critOnly = [{ minValue: null, maxValue: null, criticalLow: 1.0, criticalHigh: 9.0 }];
      expect(evaluate(0.5, critOnly).isCritical).toBe(true);
      expect(evaluate(0.5, critOnly).isAbnormal).toBe(true);
      expect(evaluate(5.0, critOnly).isCritical).toBe(false);
    });
  });
});
