import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'spine-build-'));

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('production build', () => {
  it('contains no file with the text "__sim"', async () => {
    // Vitest sets NODE_ENV=test, which would make Vite build in development
    // mode; a real `npm run build` runs with NODE_ENV=production.
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({ root, mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    } finally {
      process.env.NODE_ENV = previous;
    }
    const files = listFiles(outDir);
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
    for (const file of files) {
      expect(readFileSync(file, 'utf8').includes('__sim'), file).toBe(false);
    }
  }, 120_000);
});
