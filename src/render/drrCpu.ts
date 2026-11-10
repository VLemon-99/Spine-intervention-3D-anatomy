// CPU reference X-ray image (DRR) — docs/SPEC.md F2.1.
//
// A slow but simple version of the GPU image (drrGpu.ts), in plain TypeScript
// with no browser code, so unit tests can check the maths and screen tests can
// compare the GPU image with it. It follows the ORDER OF STEPS at the top of
// pipeline.ts; so far only step 2 (absorption) without the extra volume.
//
// Sampling is the same as in the GPU shader: the ray is clipped to the
// volume's box, samples are taken at entry + (i + 0.5) × step, and each sample
// reads the nearest voxel.
import { IMAGE_SIZE_PX, createProjection, type Pixel, type Projection } from '../core/geometry';
import type { CArmPose, Vec3, Volume } from '../core/types';
import { ABSORPTION_PER_MM, MARCH_STEP_MM, MAX_MARCH_STEPS } from './pipeline';

/** Options of the CPU reference. Later F2 stories add to this. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DrrCpuOptions {}

export interface DrrImage {
  width: number;
  height: number;
  /** Brightness 0…1 (1 = full brightness); pixel (x, y) is at index x + width × y, y from the top. */
  data: Float32Array;
}

const IDENTITY: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

/** Volumes must be in the standard layout (owner decision 2026-11-10). */
function assertStandardLayout(volume: Volume): void {
  const ok = IDENTITY.every((axis, n) => {
    const o = volume.orientation[n];
    return o !== undefined && o.x === axis.x && o.y === axis.y && o.z === axis.z;
  });
  if (!ok) {
    throw new Error(
      `Volume '${volume.region}': unsupported orientation. The renderer needs the standard layout ` +
        '(voxel axes along patient left, back, head — the identity orientation).',
    );
  }
}

/** As in the shader: a direction part that is (almost) zero is nudged so dividing by it is safe. */
const safe = (d: number): number => (Math.abs(d) < 1e-8 ? 1e-8 : d);

/** The march along one ray, after the layout check. */
function march(volume: Volume, projection: Projection, pixel: Pixel): number {
  const { origin, spacing, size, intensity } = volume;
  const { origin: source, direction: dir } = projection.unproject(pixel);

  // The box spans from the outer face of the first voxel to that of the last.
  const minX = origin.x - spacing.x / 2;
  const minY = origin.y - spacing.y / 2;
  const minZ = origin.z - spacing.z / 2;
  const maxX = origin.x + (size.x - 0.5) * spacing.x;
  const maxY = origin.y + (size.y - 0.5) * spacing.y;
  const maxZ = origin.z + (size.z - 0.5) * spacing.z;

  // Where the ray enters and leaves the box (slab method).
  const ax = (minX - source.x) / safe(dir.x);
  const bx = (maxX - source.x) / safe(dir.x);
  const ay = (minY - source.y) / safe(dir.y);
  const by = (maxY - source.y) / safe(dir.y);
  const az = (minZ - source.z) / safe(dir.z);
  const bz = (maxZ - source.z) / safe(dir.z);
  const tNear = Math.max(Math.min(ax, bx), Math.min(ay, by), Math.min(az, bz), 0);
  const tFar = Math.min(Math.max(ax, bx), Math.max(ay, by), Math.max(az, bz));

  let total = 0;
  for (let n = 0; n < MAX_MARCH_STEPS; n++) {
    const t = tNear + (n + 0.5) * MARCH_STEP_MM;
    if (t > tFar) break;
    // Nearest voxel, clamped to the grid like a texture lookup at the box edge.
    const i = Math.min(size.x - 1, Math.max(0, Math.floor((source.x + dir.x * t - minX) / spacing.x)));
    const j = Math.min(size.y - 1, Math.max(0, Math.floor((source.y + dir.y * t - minY) / spacing.y)));
    const k = Math.min(size.z - 1, Math.max(0, Math.floor((source.z + dir.z * t - minZ) / spacing.z)));
    const value = intensity[i + size.x * (j + size.y * k)] ?? 0;
    total += (value / 255) * ABSORPTION_PER_MM * MARCH_STEP_MM;
  }
  return Math.exp(-total);
}

/**
 * Fraction of the X-rays (0…1) that gets through the volume along the ray of
 * one image pixel position (e.g. { x: 255.5, y: 255.5 } for the centre of
 * pixel (255, 255)). For checking single rays quickly.
 */
export function transmissionAt(
  volume: Volume,
  projection: Projection,
  pixel: Pixel,
  options: DrrCpuOptions = {},
): number {
  void options; // no options yet; later F2 stories use them
  assertStandardLayout(volume);
  return march(volume, projection, pixel);
}

/** The whole 512×512 reference image of `volume` at `pose`. */
export function renderDrrCpu(volume: Volume, pose: CArmPose, options: DrrCpuOptions = {}): DrrImage {
  void options; // no options yet; later F2 stories use them
  assertStandardLayout(volume);
  const projection = createProjection(pose);
  const width = IMAGE_SIZE_PX;
  const height = IMAGE_SIZE_PX;
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[x + width * y] = march(volume, projection, { x: x + 0.5, y: y + 0.5 });
    }
  }
  return { width, height, data };
}
