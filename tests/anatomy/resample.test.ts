import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET_SPACING_MM, resampleVolume, type ResampleInput } from '../../tools/anatomy/resample';

function volume(size: { x: number; y: number; z: number }, spacing: { x: number; y: number; z: number }): ResampleInput {
  const count = size.x * size.y * size.z;
  return {
    size,
    spacing,
    origin: { x: -12.5, y: 7, z: 300 },
    intensity: Uint8Array.from({ length: count }, (_, n) => (n * 13) % 256),
    labels: Uint8Array.from({ length: count }, (_, n) => [0, 3, 4, 8][n % 4]),
    levels: Uint8Array.from({ length: count }, (_, n) => [0, 22, 23][n % 3]),
  };
}

/** Intensity-weighted centre, in patient mm. */
function brightCentre(v: ResampleInput) {
  let w = 0;
  const c = { x: 0, y: 0, z: 0 };
  let n = 0;
  for (let k = 0; k < v.size.z; k++)
    for (let j = 0; j < v.size.y; j++)
      for (let i = 0; i < v.size.x; i++, n++) {
        const val = v.intensity[n];
        w += val;
        c.x += val * (v.origin.x + i * v.spacing.x);
        c.y += val * (v.origin.y + j * v.spacing.y);
        c.z += val * (v.origin.z + k * v.spacing.z);
      }
  return { x: c.x / w, y: c.y / w, z: c.z / w };
}

describe('resampleVolume', () => {
  it('defaults to 1 mm', () => {
    expect(DEFAULT_TARGET_SPACING_MM).toBe(1);
  });

  it('doubles the voxel count along each axis (±1) going from 2 mm to 1 mm, and reports 1 mm spacing', () => {
    const out = resampleVolume(volume({ x: 10, y: 6, z: 4 }, { x: 2, y: 2, z: 2 }));
    expect(Math.abs(out.size.x - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(out.size.y - 12)).toBeLessThanOrEqual(1);
    expect(Math.abs(out.size.z - 8)).toBeLessThanOrEqual(1);
    expect(out.spacing).toEqual({ x: 1, y: 1, z: 1 });
    expect(out.intensity.length).toBe(out.size.x * out.size.y * out.size.z);
    expect(out.labels.length).toBe(out.intensity.length);
    expect(out.levels!.length).toBe(out.intensity.length);
  });

  it('returns a volume already at the target spacing unchanged', () => {
    const v = volume({ x: 5, y: 4, z: 3 }, { x: 1, y: 1, z: 1 });
    const out = resampleVolume(v, 1);
    expect(out.size).toEqual(v.size);
    expect(out.spacing).toEqual(v.spacing);
    expect(out.origin).toEqual(v.origin);
    expect(Array.from(out.intensity)).toEqual(Array.from(v.intensity));
    expect(Array.from(out.labels)).toEqual(Array.from(v.labels));
    expect(Array.from(out.levels!)).toEqual(Array.from(v.levels!));
  });

  it('keeps the centre of a small bright block at the same patient position (within half a voxel)', () => {
    for (const spacing of [
      { x: 2, y: 2, z: 2 },
      { x: 0.7, y: 0.7, z: 2.5 },
    ]) {
      const v = volume({ x: 30, y: 30, z: 20 }, spacing);
      v.intensity.fill(0);
      for (let k = 8; k <= 10; k++) for (let j = 11; j <= 14; j++) for (let i = 5; i <= 7; i++) v.intensity[i + 30 * (j + 30 * k)] = 250;
      const before = brightCentre(v);
      const out = resampleVolume(v, 1);
      const after = brightCentre(out);
      expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.z - before.z)).toBeLessThanOrEqual(0.5);
      expect(out.origin).toEqual(v.origin);
    }
  });

  it('gives label and level volumes only values that were in the originals', () => {
    const v = volume({ x: 9, y: 7, z: 5 }, { x: 1.6, y: 0.8, z: 3 });
    const out = resampleVolume(v, { x: 1, y: 1, z: 1 });
    const labelSet = new Set(v.labels);
    const levelSet = new Set(v.levels);
    expect(out.labels.every((l) => labelSet.has(l))).toBe(true);
    expect(out.levels!.every((l) => levelSet.has(l))).toBe(true);
  });

  it('rejects a target spacing that is zero, negative or not a number', () => {
    const v = volume({ x: 2, y: 2, z: 2 }, { x: 1, y: 1, z: 1 });
    expect(() => resampleVolume(v, 0)).toThrow(/positive number/);
    expect(() => resampleVolume(v, -1)).toThrow(/positive number/);
    expect(() => resampleVolume(v, Number.NaN)).toThrow(/positive number/);
    expect(() => resampleVolume(v, { x: 1, y: 1, z: Number.POSITIVE_INFINITY })).toThrow(/positive number.*z/);
  });
});
