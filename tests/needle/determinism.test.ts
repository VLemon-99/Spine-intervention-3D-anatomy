import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPhantom } from '../../src/core/phantom';
import type { NeedleState } from '../../src/core/types';
import {
  advance,
  createNeedle,
  rotateBevel,
  setHubAngles,
  toNeedleState,
  withdraw,
  type AdvanceResult,
  type NeedleModel,
} from '../../src/needle/model';

type Step =
  | { kind: 'advance'; mm: number }
  | { kind: 'withdraw'; mm: number }
  | { kind: 'hub'; pitch: number; yaw: number }
  | { kind: 'bevel'; degrees: number };

/** One fixed sequence: shallow and deep hub changes, bevel turns, into bone, out and back in. */
const SEQUENCE: Step[] = [
  { kind: 'advance', mm: 6 },
  { kind: 'hub', pitch: 4, yaw: -3 }, // shallow: pivots
  { kind: 'bevel', degrees: 45 },
  { kind: 'advance', mm: 9.3 },
  { kind: 'hub', pitch: 7, yaw: 2 }, // deep: track memory
  { kind: 'bevel', degrees: -120 },
  { kind: 'advance', mm: 30 }, // on into the lamina
  { kind: 'advance', mm: 3 }, // still against bone
  { kind: 'withdraw', mm: 4 },
  { kind: 'bevel', degrees: 180 },
  { kind: 'advance', mm: 12 },
  { kind: 'withdraw', mm: 25 }, // back to shallow: straightens
  { kind: 'hub', pitch: -2, yaw: 5 },
  { kind: 'advance', mm: 20.7 },
];

interface StepRecord {
  state: NeedleState;
  result?: AdvanceResult;
}

function run(): StepRecord[] {
  const phantom = createPhantom();
  let m: NeedleModel = createNeedle({
    needleId: 'quincke-25g-89',
    entryPoint: { x: 2, y: 42, z: 14 },
    direction: { x: -0.05, y: -1, z: 0.02 },
    preBend: 10,
  });
  const out: StepRecord[] = [{ state: toNeedleState(m) }];
  for (const step of SEQUENCE) {
    let result: AdvanceResult | undefined;
    if (step.kind === 'advance') {
      result = advance(m, step.mm, phantom);
      m = result.state;
    } else if (step.kind === 'withdraw') {
      m = withdraw(m, step.mm);
    } else if (step.kind === 'hub') {
      m = setHubAngles(m, { pitch: step.pitch, yaw: step.yaw });
    } else {
      m = rotateBevel(m, step.degrees);
    }
    out.push({ state: toNeedleState(m), result });
  }
  return out;
}

describe('determinism (F4.10)', () => {
  it('two runs of the same action sequence give exactly equal states and advance() results', () => {
    const a = run();
    const b = run();
    expect(a).toHaveLength(SEQUENCE.length + 1);
    for (let i = 0; i < a.length; i++) {
      expect(b[i].state, `state after step ${i}`).toStrictEqual(a[i].state);
      expect(b[i].result, `advance result of step ${i}`).toStrictEqual(a[i].result);
    }
    // The sequence really reaches bone at some point.
    expect(a.some((r) => r.result?.boneContact === true)).toBe(true);
  });

  it('src/needle/ contains no call to Math.random', () => {
    const dir = join(__dirname, '../../src/needle');
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(ts|js|json)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(/Math\.random/);
    }
  });
});
