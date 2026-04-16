import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Meta safety-net.
 *
 * Fails loudly if a future commit silently deletes test files or cases.
 * Bump the minimums when you add tests; justify in the PR if you remove any.
 */
describe('Frontend test coverage safety net', () => {
  const FRONTEND_ROOT = path.resolve(__dirname, '..', '..');
  const UNIT_DIR = path.join(FRONTEND_ROOT, 'tests', 'unit_tests');
  const E2E_DIR = path.join(FRONTEND_ROOT, 'tests', 'e2e');

  const listFiles = (dir: string, suffixes: string[]): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => suffixes.some((s) => f.endsWith(s)))
      .map((f) => path.join(dir, f));
  };

  const countMatches = (file: string, re: RegExp): number => {
    const body = fs.readFileSync(file, 'utf8');
    return (body.match(re) || []).length;
  };

  const countCases = (files: string[]): number =>
    files.reduce((acc, f) => acc + countMatches(f, /(^|\s)(it|test)\s*\(/g), 0);

  it('frontend unit test file count must not regress', () => {
    const files = listFiles(UNIT_DIR, ['.test.ts', '.test.tsx']);
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it('frontend unit test case count must not regress', () => {
    const files = listFiles(UNIT_DIR, ['.test.ts', '.test.tsx']);
    const cases = countCases(files);
    expect(cases).toBeGreaterThanOrEqual(100);
  });

  it('frontend e2e spec file count must not regress', () => {
    const files = listFiles(E2E_DIR, ['.spec.ts']);
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('no frontend unit test is silently skipped', () => {
    const all = listFiles(UNIT_DIR, ['.test.ts', '.test.tsx']);
    for (const file of all) {
      const body = fs.readFileSync(file, 'utf8');
      expect(body, `skipped test found in ${path.basename(file)}`).not.toMatch(
        /\b(it|test|describe)\.skip\s*\(/,
      );
    }
  });
});
