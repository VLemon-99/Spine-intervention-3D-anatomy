import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

describe('npm run anatomy:convert', () => {
  it('prints a usage line and exits with an error when no folders are given', () => {
    // Fixed argument list, no shell: nothing is glued into a command string.
    const result = spawnSync(npm, ['run', '--silent', 'anatomy:convert'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('<input-folder> <output-folder>');
  }, 60_000);
});
