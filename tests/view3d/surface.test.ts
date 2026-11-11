import { describe, expect, it } from 'vitest';
import { buildSurface, type SurfaceMesh } from '../../src/view3d/surface';
import { TISSUE, isBone } from '../../src/core/labels';
import { createPhantom } from '../../src/core/phantom';
import type { Vec3, Volume } from '../../src/core/types';

const BONE = [TISSUE.corticalBone, TISSUE.cancellousBone];

/** A small fake volume of air with the given voxels set to cortical bone. */
function testVolume(
  size: { x: number; y: number; z: number },
  boneVoxels: [number, number, number][],
  spacing: Vec3 = { x: 1, y: 1, z: 1 },
  origin: Vec3 = { x: 0, y: 0, z: 0 },
): Volume {
  const n = size.x * size.y * size.z;
  const labels = new Uint8Array(n);
  for (const [i, j, k] of boneVoxels) labels[i + size.x * (j + size.y * k)] = TISSUE.corticalBone;
  return {
    region: 'test',
    size,
    spacing,
    origin,
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity: new Uint8Array(n),
    labels,
  };
}

function triangleCount(mesh: SurfaceMesh): number {
  return mesh.positions.length / 9;
}

/** Corners and normal of triangle t. */
function triangle(mesh: SurfaceMesh, t: number): { corners: Vec3[]; normal: Vec3 } {
  const corners: Vec3[] = [];
  for (let c = 0; c < 3; c++) {
    const o = t * 9 + c * 3;
    corners.push({ x: mesh.positions[o], y: mesh.positions[o + 1], z: mesh.positions[o + 2] });
  }
  const o = t * 9;
  return { corners, normal: { x: mesh.normals[o], y: mesh.normals[o + 1], z: mesh.normals[o + 2] } };
}

function labelAt(volume: Volume, p: Vec3): number {
  const i = Math.round((p.x - volume.origin.x) / volume.spacing.x);
  const j = Math.round((p.y - volume.origin.y) / volume.spacing.y);
  const k = Math.round((p.z - volume.origin.z) / volume.spacing.z);
  const { x: nx, y: ny, z: nz } = volume.size;
  if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return TISSUE.air;
  return volume.labels[i + nx * (j + ny * k)];
}

describe('buildSurface', () => {
  it('gives 12 outward-facing triangles on the faces of a single voxel', () => {
    const spacing = { x: 2, y: 1.5, z: 1 };
    const origin = { x: -10, y: 4, z: 7 };
    const volume = testVolume({ x: 3, y: 3, z: 3 }, [[1, 1, 1]], spacing, origin);
    const mesh = buildSurface(volume, BONE);
    expect(triangleCount(mesh)).toBe(12);
    expect(mesh.normals.length).toBe(mesh.positions.length);

    const centre = { x: origin.x + spacing.x, y: origin.y + spacing.y, z: origin.z + spacing.z };
    const half = { x: spacing.x / 2, y: spacing.y / 2, z: spacing.z / 2 };
    const seenNormals = new Set<string>();
    for (let t = 0; t < 12; t++) {
      const { corners, normal } = triangle(mesh, t);
      // Unit normal along one axis.
      expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 6);
      seenNormals.add(`${normal.x},${normal.y},${normal.z}`);
      for (const p of corners) {
        // Each corner is a corner of the voxel: ±half a voxel from its centre.
        expect(Math.abs(p.x - centre.x)).toBeCloseTo(half.x, 6);
        expect(Math.abs(p.y - centre.y)).toBeCloseTo(half.y, 6);
        expect(Math.abs(p.z - centre.z)).toBeCloseTo(half.z, 6);
        // On the face the normal points out of: the coordinate along the
        // normal is on the normal's side of the centre.
        const along = (p.x - centre.x) * normal.x + (p.y - centre.y) * normal.y + (p.z - centre.z) * normal.z;
        const halfAlong = Math.abs(normal.x) * half.x + Math.abs(normal.y) * half.y + Math.abs(normal.z) * half.z;
        expect(along).toBeCloseTo(halfAlong, 6);
      }
      // Winding agrees with the normal (counter-clockwise seen from outside).
      const [a, b, c] = corners;
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const cross = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
      expect(cross.x * normal.x + cross.y * normal.y + cross.z * normal.z).toBeGreaterThan(0);
    }
    expect(seenNormals.size).toBe(6);
  });

  it('leaves out the face shared by two neighbouring voxels (20 triangles)', () => {
    const volume = testVolume({ x: 3, y: 3, z: 3 }, [
      [1, 1, 1],
      [2, 1, 1],
    ]);
    expect(triangleCount(buildSurface(volume, BONE))).toBe(20);
  });

  it('gives a voxel on the edge of the grid its outer face', () => {
    const volume = testVolume({ x: 3, y: 3, z: 3 }, [[0, 0, 0]]);
    const mesh = buildSurface(volume, BONE);
    expect(triangleCount(mesh)).toBe(12);
    let outerX = 0;
    for (let t = 0; t < triangleCount(mesh); t++) {
      const { corners, normal } = triangle(mesh, t);
      if (normal.x === -1) {
        outerX++;
        for (const p of corners) expect(p.x).toBeCloseTo(-0.5, 6);
      }
    }
    expect(outerX).toBe(2);
  });

  it('gives an empty mesh when no voxel is in the set', () => {
    const volume = testVolume({ x: 3, y: 3, z: 3 }, []);
    const mesh = buildSurface(volume, BONE);
    expect(mesh.positions.length).toBe(0);
    expect(mesh.normals.length).toBe(0);
  });

  it('on the phantom, every triangle has bone behind it and no bone in front', () => {
    const volume = createPhantom();
    const mesh = buildSurface(volume, BONE);
    const count = triangleCount(mesh);
    expect(count).toBeGreaterThan(0);
    for (let t = 0; t < count; t++) {
      const { corners, normal } = triangle(mesh, t);
      const c = {
        x: (corners[0].x + corners[1].x + corners[2].x) / 3,
        y: (corners[0].y + corners[1].y + corners[2].y) / 3,
        z: (corners[0].z + corners[1].z + corners[2].z) / 3,
      };
      const h = {
        x: (normal.x * volume.spacing.x) / 2,
        y: (normal.y * volume.spacing.y) / 2,
        z: (normal.z * volume.spacing.z) / 2,
      };
      const behind = labelAt(volume, { x: c.x - h.x, y: c.y - h.y, z: c.z - h.z });
      const front = labelAt(volume, { x: c.x + h.x, y: c.y + h.y, z: c.z + h.z });
      if (!isBone(behind) || isBone(front)) {
        throw new Error(`triangle ${t} at (${c.x}, ${c.y}, ${c.z}): behind ${behind}, front ${front}`);
      }
    }
  });

  it('rejects a volume that is not in the standard layout', () => {
    const volume = testVolume({ x: 3, y: 3, z: 3 }, [[1, 1, 1]]);
    volume.orientation = [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    expect(() => buildSurface(volume, BONE)).toThrow(/orientation|layout/i);
  });
});
