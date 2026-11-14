import { describe, expect, it } from 'vitest';
import { createPhantom } from '../../src/core/phantom';
import { TISSUE } from '../../src/core/labels';
import { createProjection, type Pixel } from '../../src/core/geometry';
import type { CArmPose, Vec3, Volume } from '../../src/core/types';
import { labelAt } from '../../src/needle/sample';
import { skinEntry } from '../../src/needle/entry';

const phantom = createPhantom();
const pose = (oblique: number, tilt: number): CArmPose => ({
  oblique,
  tilt,
  tableLeftRight: 0,
  tableHeadFoot: 0,
  tableHeight: 0,
});
const AP = pose(0, 0);
const along = (p: Vec3, d: Vec3, s: number): Vec3 => ({ x: p.x + d.x * s, y: p.y + d.y * s, z: p.z + d.z * s });

/** Pixels whose rays pass through the phantom's body. */
const BODY_PIXELS: Pixel[] = [
  { x: 256, y: 256 },
  { x: 220, y: 240 },
  { x: 290, y: 280 },
  { x: 256, y: 200 },
  { x: 230, y: 300 },
];

/** Distance (mm) from p along d to where the ray leaves the phantom's grid. */
function distanceToGridEdge(volume: Volume, p: Vec3, d: Vec3): number {
  let s = 0;
  const lo = (o: number, sp: number) => o - sp / 2;
  const hi = (o: number, sp: number, n: number) => o + (n - 0.5) * sp;
  for (;;) {
    const q = along(p, d, s);
    if (
      q.x < lo(volume.origin.x, volume.spacing.x) ||
      q.y < lo(volume.origin.y, volume.spacing.y) ||
      q.z < lo(volume.origin.z, volume.spacing.z) ||
      q.x > hi(volume.origin.x, volume.spacing.x, volume.size.x) ||
      q.y > hi(volume.origin.y, volume.spacing.y, volume.size.y) ||
      q.z > hi(volume.origin.z, volume.spacing.z, volume.size.z)
    )
      return s;
    s += 0.05;
  }
}

describe('skinEntry', () => {
  it('finds the back skin for the image-centre ray at 0°/0°', () => {
    const ray = createProjection(AP).unproject({ x: 256, y: 256 });
    const hit = skinEntry(phantom, ray);
    expect(hit).not.toBeNull();
    const p = hit as Vec3;
    expect(p.y).toBeGreaterThan(30);
    expect(labelAt(phantom, p)).not.toBe(TISSUE.air);
    expect(labelAt(phantom, along(p, ray.direction, 1))).toBe(TISSUE.air);
  });

  it('never returns a point on the belly side at 0°/0°', () => {
    const projection = createProjection(AP);
    for (const pixel of BODY_PIXELS) {
      const p = skinEntry(phantom, projection.unproject(pixel));
      expect(p).not.toBeNull();
      expect((p as Vec3).y).toBeGreaterThan(-30);
      expect((p as Vec3).y).toBeGreaterThan(30);
    }
  });

  it('projects back to its pixel and has only air toward the detector, at several poses', () => {
    for (const ps of [AP, pose(20, 10), pose(-25, -5)]) {
      const projection = createProjection(ps);
      for (const pixel of BODY_PIXELS) {
        const ray = projection.unproject(pixel);
        const p = skinEntry(phantom, ray);
        expect(p, `pose ${ps.oblique}/${ps.tilt} pixel ${pixel.x},${pixel.y}`).not.toBeNull();
        const point = p as Vec3;
        const back = projection.project(point);
        expect(Math.hypot(back.x - pixel.x, back.y - pixel.y)).toBeLessThan(0.5);
        expect(labelAt(phantom, point)).not.toBe(TISSUE.air);
        const edge = distanceToGridEdge(phantom, point, ray.direction);
        for (let s = 0.2; s <= edge; s += 0.2) {
          expect(labelAt(phantom, along(point, ray.direction, s))).toBe(TISSUE.air);
        }
      }
    }
  });

  it('returns null for a ray that misses the body', () => {
    const ray = createProjection(AP).unproject({ x: 0.5, y: 0.5 });
    expect(skinEntry(phantom, ray)).toBeNull();
  });

  it('rejects a volume that is not in the standard layout', () => {
    const turned: Volume = {
      ...phantom,
      orientation: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
    };
    const ray = createProjection(AP).unproject({ x: 256, y: 256 });
    expect(() => skinEntry(turned, ray)).toThrow(/standard layout/);
  });
});
