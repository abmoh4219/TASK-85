import * as fs from 'fs';
import * as path from 'path';

/**
 * Meta safety-net.
 *
 * These assertions fail loudly if a future commit silently deletes test files
 * or test cases. Keep the minimums at-or-below the last known good counts.
 * If you add tests, bump the minimums. If you must remove tests, do it
 * explicitly and justify in the PR.
 */
describe('Backend test coverage safety net', () => {
  const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
  const UNIT_DIR = path.join(BACKEND_ROOT, 'tests', 'unit_tests');
  const API_DIR = path.join(BACKEND_ROOT, 'tests', 'api_tests');

  const listSpecs = (dir: string, suffix: string): string[] =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(suffix))
      .map((f) => path.join(dir, f));

  const countMatches = (file: string, re: RegExp): number => {
    const body = fs.readFileSync(file, 'utf8');
    return (body.match(re) || []).length;
  };

  const countCases = (files: string[]): number =>
    files.reduce((acc, f) => acc + countMatches(f, /(^|\s)(it|test)\s*\(/g), 0);

  it('backend unit test file count must not regress', () => {
    const files = listSpecs(UNIT_DIR, '.spec.ts');
    expect(files.length).toBeGreaterThanOrEqual(19);
  });

  it('backend unit test case count must not regress', () => {
    const files = listSpecs(UNIT_DIR, '.spec.ts');
    const cases = countCases(files);
    expect(cases).toBeGreaterThanOrEqual(340);
  });

  it('backend api test file count must not regress', () => {
    const files = listSpecs(API_DIR, '.e2e-spec.ts');
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  it('backend api test case count must not regress', () => {
    const files = listSpecs(API_DIR, '.e2e-spec.ts');
    const cases = countCases(files);
    expect(cases).toBeGreaterThanOrEqual(210);
  });

  it('no backend test is silently skipped', () => {
    const all = [
      ...listSpecs(UNIT_DIR, '.spec.ts'),
      ...listSpecs(API_DIR, '.e2e-spec.ts'),
    ];
    for (const file of all) {
      const body = fs.readFileSync(file, 'utf8');
      expect(body).not.toMatch(/\b(it|test|describe)\.skip\s*\(/);
    }
  });
});
