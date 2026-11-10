import { describe, expect, it } from 'vitest';
import { IMAGE_SIZE_PX, createProjection } from '../../src/core/geometry';
import { PHANTOM_SIZE, PHANTOM_SPACING_MM } from '../../src/core/phantom';
import { createRandom } from '../../src/core/random';
import type { CArmPose, Vec3 } from '../../src/core/types';

const pose = (oblique: number, tilt: number, table: Partial<CArmPose> = {}): CArmPose => ({
  oblique,
  tilt,
  tableLeftRight: 0,
  tableHeadFoot: 0,
  tableHeight: 0,
  ...table,
});

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec3): number => Math.sqrt(dot(a, a));
/** Distance from point p to the line through origin with unit direction d. */
const distanceToRay = (origin: Vec3, d: Vec3, p: Vec3): number => {
  const v = sub(p, origin);
  const t = dot(v, d);
  return length(sub(v, { x: d.x * t, y: d.y * t, z: d.z * t }));
};
const centralRay = (p: ReturnType<typeof createProjection>): Vec3 => {
  const v = sub(p.detectorCentre, p.source);
  const l = length(v);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

const tableOffsets: Partial<CArmPose>[] = [
  {},
  { tableLeftRight: 35, tableHeadFoot: -120, tableHeight: 40 },
  { tableLeftRight: -150, tableHeadFoot: 300, tableHeight: -90 },
];
const poses: CArmPose[] = [];
for (const oblique of [-90, -60, -25, 0, 25, 60, 90]) {
  for (const tilt of [-40, 0, 40]) {
    for (const table of tableOffsets) poses.push(pose(oblique, tilt, table));
  }
}

describe('C-arm projection geometry', () => {
  it('uses a 512×512 image', () => {
    expect(IMAGE_SIZE_PX).toBe(512);
    const p = createProjection(pose(0, 0));
    expect([p.width, p.height]).toEqual([512, 512]);
  });

  it('projects the isocentre to the image centre for every pose and table offset', () => {
    expect(poses.length).toBeGreaterThanOrEqual(20);
    for (const ps of poses) {
      const p = createProjection(ps);
      const pixel = p.project(p.isocentre);
      expect(Math.abs(pixel.x - 256), JSON.stringify(ps)).toBeLessThan(0.5);
      expect(Math.abs(pixel.y - 256), JSON.stringify(ps)).toBeLessThan(0.5);
      // The isocentre is where the table offsets put the origin of the table frame.
      expect(p.isocentre).toEqual({ x: -ps.tableLeftRight, y: -ps.tableHeight, z: -ps.tableHeadFoot });
    }
  });

  it('project then unproject gives a ray within 0.1 mm of the original point', () => {
    const random = createRandom(2026);
    const half = ((PHANTOM_SIZE - 1) / 2) * PHANTOM_SPACING_MM;
    const testPoses = [
      pose(0, 0),
      pose(25, 0),
      pose(-25, 10),
      pose(90, 0),
      pose(-90, -20),
      pose(45, 40),
      pose(-60, -40),
      pose(10, 15, { tableLeftRight: 20, tableHeadFoot: -30, tableHeight: 10 }),
      pose(-35, 5, { tableLeftRight: -40, tableHeadFoot: 60, tableHeight: -25 }),
      pose(70, -10, { tableHeight: 50 }),
    ];
    for (const ps of testPoses) {
      const p = createProjection(ps);
      for (let n = 0; n < 50; n++) {
        const point = {
          x: (random() * 2 - 1) * half,
          y: (random() * 2 - 1) * half,
          z: (random() * 2 - 1) * half,
        };
        const ray = p.unproject(p.project(point));
        expect(Math.abs(length(ray.direction) - 1)).toBeLessThan(1e-9);
        expect(distanceToRay(ray.origin, ray.direction, point)).toBeLessThan(0.1);
      }
    }
  });

  it('pose (0°, 0°) is a straight AP beam for a prone patient', () => {
    const p = createProjection(pose(0, 0));
    expect(p.source.y).toBeLessThan(0); // under the table (anterior)
    expect(p.detectorCentre.y).toBeGreaterThan(0); // above the back (posterior)
    const d = centralRay(p);
    expect(Math.abs(d.y)).toBeCloseTo(1, 9);
    expect(Math.abs(d.x)).toBeLessThan(1e-9);
    expect(Math.abs(d.z)).toBeLessThan(1e-9);
  });

  it('oblique +90° is a lateral beam with the detector on the patient\'s right', () => {
    const p = createProjection(pose(90, 0));
    const d = centralRay(p);
    expect(Math.abs(d.x)).toBeCloseTo(1, 9);
    expect(Math.abs(d.y)).toBeLessThan(1e-9);
    expect(Math.abs(d.z)).toBeLessThan(1e-9);
    expect(p.detectorCentre.x).toBeLessThan(0);
    expect(p.source.x).toBeGreaterThan(0);
  });

  it('oblique +25° swings the detector to the patient\'s right, −25° to the left', () => {
    const right = createProjection(pose(25, 0));
    expect(right.detectorCentre.x).toBeLessThan(0);
    expect(right.detectorCentre.y).toBeGreaterThan(0);
    const left = createProjection(pose(-25, 0));
    expect(left.detectorCentre.x).toBeGreaterThan(0);
    expect(left.detectorCentre.y).toBeGreaterThan(0);
  });

  it('tilt +20° is cranial (detector toward the head), −20° caudal', () => {
    const cranial = createProjection(pose(0, 20));
    expect(cranial.detectorCentre.z).toBeGreaterThan(0);
    expect(cranial.detectorCentre.y).toBeGreaterThan(0);
    expect(cranial.source.z).toBeLessThan(0);
    const caudal = createProjection(pose(0, -20));
    expect(caudal.detectorCentre.z).toBeLessThan(0);
  });

  it('shows the head at the top of the image at pose (0°, 0°)', () => {
    const p = createProjection(pose(0, 0));
    expect(p.project({ x: 0, y: 0, z: 30 }).y).toBeLessThan(256);
    // Viewed from behind the prone patient: the patient's right (−x) is on the image's right.
    expect(p.project({ x: -30, y: 0, z: 0 }).x).toBeGreaterThan(256);
  });
});
