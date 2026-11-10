import { describe, expect, it } from 'vitest';
import { POSE_KEYS, stepPose } from '../../src/carm/keymap';
import { POSE_LIMITS } from '../../src/carm/limits';
import type { CArmPose } from '../../src/core/types';

const zero: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };

// The documented keys (event.code), the value each one moves and its direction.
const EXPECTED: [string, keyof CArmPose, 1 | -1, 'angle' | 'table'][] = [
  ['KeyJ', 'oblique', -1, 'angle'], // oblique left
  ['KeyL', 'oblique', 1, 'angle'], // oblique right
  ['KeyI', 'tilt', 1, 'angle'], // cranial
  ['KeyK', 'tilt', -1, 'angle'], // caudal
  ['KeyN', 'tableLeftRight', -1, 'table'], // toward the patient's right
  ['KeyM', 'tableLeftRight', 1, 'table'], // toward the patient's left
  ['KeyU', 'tableHeadFoot', 1, 'table'], // toward the head
  ['KeyO', 'tableHeadFoot', -1, 'table'], // toward the feet
  ['KeyY', 'tableHeight', 1, 'table'], // up
  ['KeyH', 'tableHeight', -1, 'table'], // down
];

describe('POSE_KEYS', () => {
  it('lists exactly the ten documented keys', () => {
    expect(POSE_KEYS.map((k) => k.code).sort()).toEqual(EXPECTED.map((e) => e[0]).sort());
  });

  it('avoids the keys reserved for the needle, Space and F', () => {
    const reserved = ['KeyW', 'KeyS', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyF'];
    for (const k of POSE_KEYS) expect(reserved).not.toContain(k.code);
  });
});

describe('stepPose', () => {
  for (const [code, field, sign, kind] of EXPECTED) {
    it(`${code} changes only ${field}, by ${sign * (kind === 'angle' ? 1 : 5)}`, () => {
      const next = stepPose(zero, code, false);
      expect(next).toEqual({ ...zero, [field]: sign * (kind === 'angle' ? 1 : 5) });
    });

    it(`${code} with Shift steps ${kind === 'angle' ? '5°' : 'still 5 mm'}`, () => {
      expect(stepPose(zero, code, true)).toEqual({ ...zero, [field]: sign * 5 });
    });

    it(`${code} stays at the limit when stepping past it`, () => {
      const limit = sign > 0 ? POSE_LIMITS[field].max : POSE_LIMITS[field].min;
      const atLimit = { ...zero, [field]: limit };
      expect(stepPose(atLimit, code, false)?.[field]).toBe(limit);
      expect(stepPose(atLimit, code, true)?.[field]).toBe(limit);
      // A Shift step that would pass the limit stops at it.
      const nearLimit = { ...zero, [field]: limit - sign * 2 };
      expect(stepPose(nearLimit, code, true)?.[field]).toBe(limit);
    });
  }

  it('returns null for a key that is not a pose key', () => {
    expect(stepPose(zero, 'KeyF', false)).toBeNull();
    expect(stepPose(zero, 'Space', false)).toBeNull();
    expect(stepPose(zero, 'KeyW', true)).toBeNull();
  });

  it('does not change the pose it is given', () => {
    const pose = { ...zero };
    stepPose(pose, 'KeyL', false);
    expect(pose).toEqual(zero);
  });
});
