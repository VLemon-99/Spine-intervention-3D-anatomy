import { describe, expect, it } from 'vitest';
import { DETECTOR_SIZE_MM, createProjection } from '../../src/core/geometry';
import type { CArmPose, Vec3 } from '../../src/core/types';
import { carmModel } from '../../src/view3d/carmModel';

const POSES: CArmPose[] = [
  { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
  { oblique: 25, tilt: -15, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 },
  { oblique: -40, tilt: 20, tableLeftRight: 30, tableHeadFoot: -45, tableHeight: 12 },
];

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

function expectClose(a: Vec3, b: Vec3): void {
  expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-9);
}

describe('carmModel', () => {
  it('matches createProjection for three poses, with corners 150 mm along right and up', () => {
    expect(DETECTOR_SIZE_MM / 2).toBe(150);
    for (const pose of POSES) {
      const projection = createProjection(pose);
      const model = carmModel(pose);
      expectClose(model.source, projection.source);
      expectClose(model.detectorCentre, projection.detectorCentre);

      // Expected (right, up) offsets: top-left, top-right, bottom-right, bottom-left.
      const expected = [
        [-150, 150],
        [150, 150],
        [150, -150],
        [-150, -150],
      ];
      model.detectorCorners.forEach((corner, i) => {
        const offset = sub(corner, projection.detectorCentre);
        expect(dot(offset, projection.detectorRight)).toBeCloseTo(expected[i]![0]!, 9);
        expect(dot(offset, projection.detectorUp)).toBeCloseTo(expected[i]![1]!, 9);
        // In the detector plane: nothing along the beam.
        expect(dot(offset, projection.beamDirection)).toBeCloseTo(0, 9);
      });
    }
  });
});
