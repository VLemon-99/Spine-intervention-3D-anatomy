import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';
import vitestConfig from '../../vitest.config';

const root = fileURLToPath(new URL('../../', import.meta.url));
const readText = (file: string): string => readFileSync(root + file, 'utf8');

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(readText('package.json')) as PackageJson;

// An exact version looks like 1.2.3 (optionally with a pre-release tag),
// with no ^, ~, *, x, ranges, tags such as "latest", or URLs.
const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

describe('project configuration', () => {
  it('pins @playwright/test to exactly 1.63.0', () => {
    expect(pkg.devDependencies?.['@playwright/test']).toBe('1.63.0');
  });

  it('pins every dependency and dev dependency to an exact version', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).length).toBeGreaterThan(0);
    for (const [name, version] of Object.entries(all)) {
      expect(version, `${name}@${version} is not an exact version`).toMatch(EXACT_VERSION);
    }
  });

  it('has the scripts dev, build, test, lint, typecheck and check', () => {
    for (const script of ['dev', 'build', 'test', 'lint', 'typecheck', 'check']) {
      expect(pkg.scripts?.[script], `missing script "${script}"`).toBeTruthy();
    }
  });

  it('has the page title "Spine Fluoro Trainer" in index.html', () => {
    expect(readText('index.html')).toContain('<title>Spine Fluoro Trainer</title>');
  });

  it('serves the dev server on port 5173 with strictPort', () => {
    expect(viteConfig.server?.port).toBe(5173);
    expect(viteConfig.server?.strictPort).toBe(true);
  });

  it('runs unit tests in the node environment, includes tests/**/*.test.ts and excludes tests/e2e/', () => {
    const test = vitestConfig.test;
    expect(test?.environment).toBe('node');
    expect(test?.include).toContain('tests/**/*.test.ts');
    expect(test?.exclude?.some((pattern) => pattern.startsWith('tests/e2e'))).toBe(true);
  });
});
