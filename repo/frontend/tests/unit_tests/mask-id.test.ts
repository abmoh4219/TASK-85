import { describe, it, expect } from 'vitest';
import { maskId } from '../../src/lib/mask-id';

describe('maskId', () => {
  it('returns em-dash placeholder for null', () => {
    expect(maskId(null)).toBe('—');
  });

  it('returns em-dash placeholder for undefined', () => {
    expect(maskId(undefined)).toBe('—');
  });

  it('returns em-dash placeholder for empty string', () => {
    expect(maskId('')).toBe('—');
  });

  it('returns short string (<=4 chars) unchanged', () => {
    expect(maskId('1234')).toBe('1234');
    expect(maskId('abc')).toBe('abc');
    expect(maskId('a')).toBe('a');
  });

  it('masks long string showing only the last 4 characters', () => {
    expect(maskId('1234567890')).toBe('****7890');
  });

  it('masks id with alphanumeric characters', () => {
    expect(maskId('SSN-12-3456')).toBe('****3456');
  });

  it('masks very long string keeping exactly last 4 characters', () => {
    const result = maskId('abcdefghijklmnopqrstuvwxyz');
    expect(result).toBe('****wxyz');
    expect(result.endsWith('wxyz')).toBe(true);
  });

  it('handles 5-character string (first longer-than-4 case)', () => {
    expect(maskId('12345')).toBe('****2345');
  });
});
