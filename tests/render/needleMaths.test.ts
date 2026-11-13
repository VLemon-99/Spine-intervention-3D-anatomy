import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../src/core/types';
import {
  MAX_NEEDLE_SEGMENTS,
  NEEDLE_ABSORPTION_PER_MM,
  NEEDLE_RADIUS_MM,
  needlePathLength,
  resampleShaft,
} from '../../src/render/pipeline';

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** A curved shaft (quarter-ish arc in the y–z plane) of 400 unevenly spaced points. */
function curvedShaft(): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < 400; i++) {
    const s = (i / 399) ** 1.7; // uneven spacing along the curve
    const angle = s * 0.8;
    points.push({ x: 3, y: 40 - 60 * Math.sin(angle), z: 60 * (1 - Math.cos(angle)) });
  }
  return points;
}

describe('needle numbers', () => {
  it('has the drafted values', () => {
    expect(NEEDLE_RADIUS_MM).toBe(0.35);
    expect(MAX_NEEDLE_SEGMENTS).toBe(64);
    expect(NEEDLE_ABSORPTION_PER_MM).toBeGreaterThan(0);
  });
});

describe('resampleShaft', () => {
  it('turns a 400-point curve into at most 65 evenly spaced points, keeping hub and tip', () => {
    const shaft = curvedShaft();
    const out = resampleShaft(shaft);
    expect(out.length).toBeLessThanOrEqual(MAX_NEEDLE_SEGMENTS + 1);
    expect(out.length).toBeGreaterThan(2);
    expect(out[0]).toEqual(shaft[0]);
    expect(out[out.length - 1]).toEqual(shaft[shaft.length - 1]);
    const gaps = out.slice(1).map((p, i) => dist(out[i], p));
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const g of gaps) expect(Math.abs(g - mean) / mean).toBeLessThan(0.01);
  });

  it('gives an empty shaft for no points and the same point for one point', () => {
    expect(resampleShaft([])).toEqual([]);
    expect(resampleShaft([{ x: 1, y: 2, z: 3 }])).toEqual([{ x: 1, y: 2, z: 3 }]);
  });
});

describe('needlePathLength', () => {
  const segment: Vec3[] = [
    { x: 0, y: 0, z: -10 },
    { x: 0, y: 0, z: 10 },
  ];

  it('a ray crossing the segment at right angles through its axis travels one diameter', () => {
    const length = needlePathLength({ x: 0, y: -100, z: 3 }, { x: 0, y: 1, z: 0 }, segment);
    expect(length).toBeCloseTo(2 * NEEDLE_RADIUS_MM, 6);
    expect(Math.abs(length - 2 * NEEDLE_RADIUS_MM) / (2 * NEEDLE_RADIUS_MM)).toBeLessThan(0.01);
  });

  it('a ray direction that is not of unit length gives the same answer', () => {
    const length = needlePathLength({ x: 0, y: -100, z: 3 }, { x: 0, y: 7, z: 0 }, segment);
    expect(length).toBeCloseTo(2 * NEEDLE_RADIUS_MM, 6);
  });

  it('a ray that passes 1 mm away misses', () => {
    expect(needlePathLength({ x: 1, y: -100, z: 3 }, { x: 0, y: 1, z: 0 }, segment)).toBe(0);
  });

  it('a ray along the segment’s own line travels its length, not infinity', () => {
    const length = needlePathLength({ x: 0, y: 0, z: -200 }, { x: 0, y: 0, z: 1 }, segment);
    expect(Number.isFinite(length)).toBe(true);
    expect(Math.abs(length - 20) / 20).toBeLessThan(0.01);
  });

  it('a ray along a resampled straight shaft travels the whole shaft length once', () => {
    const shaft = resampleShaft([
      { x: 5, y: 40, z: 0 },
      { x: 5, y: 0, z: 0 },
    ]);
    const length = needlePathLength({ x: 5, y: 300, z: 0 }, { x: 0, y: -1, z: 0 }, shaft);
    expect(Math.abs(length - 40) / 40).toBeLessThan(0.01);
  });

  it('a ray at a slant never travels more than the segment length plus a diameter', () => {
    // Shallow slant: y = −0.2 + 0.02 (z + 20) stays within 0.35 mm of the axis
    // up to z = 7.5, so the ray is inside from z = −10 to 7.5 (17.5 mm along z).
    const length = needlePathLength({ x: 0, y: -0.2, z: -20 }, { x: 0, y: 0.02, z: 1 }, segment);
    expect(length).toBeCloseTo(17.5 * Math.hypot(1, 0.02), 6);
    expect(length).toBeLessThanOrEqual(20 + 2 * NEEDLE_RADIUS_MM);
  });

  it('the needle behind the ray’s start does not count', () => {
    expect(needlePathLength({ x: 0, y: 100, z: 3 }, { x: 0, y: 1, z: 0 }, segment)).toBe(0);
  });

  it('an empty or one-point shaft gives 0', () => {
    expect(needlePathLength({ x: 0, y: -100, z: 0 }, { x: 0, y: 1, z: 0 }, [])).toBe(0);
    expect(needlePathLength({ x: 0, y: -100, z: 0 }, { x: 0, y: 1, z: 0 }, [{ x: 0, y: 0, z: 0 }])).toBe(0);
  });
});
