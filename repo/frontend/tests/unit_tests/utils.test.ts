import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  formatCurrency,
  maskIdentifier,
  daysUntil,
} from '../../src/lib/utils';

describe('cn (class name merger)', () => {
  it('merges multiple class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('handles conditional false/undefined values', () => {
    expect(cn('a', false && 'hidden', undefined, null, 'b')).toBe('a b');
  });

  it('dedupes/merges conflicting tailwind classes via twMerge', () => {
    // twMerge keeps the last conflicting utility
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('supports array and object class inputs (clsx)', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a Date object', () => {
    const out = formatDate(new Date('2024-06-15T12:00:00Z'));
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('formats an ISO date string', () => {
    const out = formatDate('2024-01-01T00:00:00Z');
    expect(out).toMatch(/2024/);
  });
});

describe('formatDateTime', () => {
  it('formats date and time', () => {
    const out = formatDateTime('2024-06-15T12:34:00Z');
    expect(out).toMatch(/2024/);
    // Should include a colon for the time portion
    expect(out).toMatch(/:/);
  });
});

describe('formatCurrency', () => {
  it('formats integer as USD', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('formats zero as USD', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats decimals as USD', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-5)).toMatch(/5\.00/);
  });
});

describe('maskIdentifier', () => {
  it('returns **** for empty string', () => {
    expect(maskIdentifier('')).toBe('****');
  });

  it('returns **** for short strings (<=4 chars)', () => {
    expect(maskIdentifier('abcd')).toBe('****');
    expect(maskIdentifier('ab')).toBe('****');
  });

  it('masks all but last 4 characters with bullet chars', () => {
    expect(maskIdentifier('123456789')).toBe('•••••6789');
  });

  it('uses correct number of bullets', () => {
    const result = maskIdentifier('abcdef');
    expect(result).toBe('••cdef');
    expect(result.endsWith('cdef')).toBe(true);
  });
});

describe('daysUntil', () => {
  it('returns 0 or near-zero for today', () => {
    const d = daysUntil(new Date());
    expect(d).toBeLessThanOrEqual(1);
    expect(d).toBeGreaterThanOrEqual(-1);
  });

  it('returns positive number for future date', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    expect(daysUntil(future)).toBeGreaterThanOrEqual(9);
    expect(daysUntil(future)).toBeLessThanOrEqual(10);
  });

  it('returns negative number for past date', () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(daysUntil(past)).toBeLessThanOrEqual(-9);
  });

  it('accepts ISO string input', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const d = daysUntil(future);
    expect(d).toBeGreaterThanOrEqual(4);
    expect(d).toBeLessThanOrEqual(5);
  });
});
