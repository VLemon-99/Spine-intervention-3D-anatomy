import { describe, expect, it } from 'vitest';
import { createProjection } from '../../src/core/geometry';
import type { NeedleState, Vec3 } from '../../src/core/types';
import { lineAngleDeg, needleBeamAngleDeg } from '../../src/needle/readouts';

const AP = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const DEG = Math.PI / 180;

function needleWithOutsideDir(entry: Vec3, dir: Vec3): NeedleState {
  const hub = { x: entry.x - dir.x * 50, y: entry.y - dir.y * 50, z: entry.z - dir.z * 50 };
  return {
    needleId: 'quincke-22g-89',
    preBend: 0,
    entryPoint: entry,
    hubAngles: { pitch: 0, yaw: 0 },
    bevelAngle: 0,
    insertedDepth: 0,
    shaft: [hub, entry],
    tip: entry,
  };
}

describe('lineAngleDeg', () => {
  it('is 0 for the same and for opposite directions, never above 90', () => {
    expect(lineAngleDeg({ x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 })).toBeCloseTo(0, 9);
    expect(lineAngleDeg({ x: 0, y: 1, z: 0 }, { x: 0, y: -3, z: 0 })).toBeCloseTo(0, 9);
    expect(lineAngleDeg({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90, 9);
    for (let a = 0; a <= 360; a += 7) {
      const v = lineAngleDeg({ x: 1, y: 0, z: 0 }, { x: Math.cos(a * DEG), y: Math.sin(a * DEG), z: 0 });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(90 + 1e-9);
    }
  });

  it('is null for a zero-length vector', () => {
    expect(lineAngleDeg({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
  });
});

describe('needleBeamAngleDeg', () => {
  const entry = { x: 0, y: 42, z: 0 };
  const beam = createProjection(AP).beamDirection; // the ray through this entry at 0°/0° is the central ray (+y)

  it('gives 0° for a needle pointing against the beam, and for one pointing along it', () => {
    const against = needleWithOutsideDir(entry, { x: -beam.x, y: -beam.y, z: -beam.z });
    const along = needleWithOutsideDir(entry, beam);
    expect(needleBeamAngleDeg(against, AP)).toBeCloseTo(0, 6);
    expect(needleBeamAngleDeg(along, AP)).toBeCloseTo(0, 6);
  });

  it('gives 30° (±0.5°) for a needle tilted 30° away from the beam', () => {
    const tilted = needleWithOutsideDir(entry, { x: Math.sin(30 * DEG), y: -Math.cos(30 * DEG), z: 0 });
    expect(Math.abs((needleBeamAngleDeg(tilted, AP) as number) - 30)).toBeLessThanOrEqual(0.5);
  });

  it('is never above 90°', () => {
    for (let a = 0; a < 360; a += 15) {
      const n = needleWithOutsideDir(entry, { x: Math.cos(a * DEG), y: Math.sin(a * DEG), z: 0.3 });
      expect(needleBeamAngleDeg(n, AP)).toBeLessThanOrEqual(90 + 1e-9);
    }
  });
});
