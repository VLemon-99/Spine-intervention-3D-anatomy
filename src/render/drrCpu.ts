// CPU reference X-ray image (DRR) — docs/SPEC.md F2.1.
//
// A slow but simple version of the GPU image (drrGpu.ts), in plain TypeScript
// with no browser code, so unit tests can check the maths and screen tests can
// compare the GPU image with it. It follows the ORDER OF STEPS at the top of
// pipeline.ts; so far step 1 (magnification), step 2 (absorption, without the
// extra volume), step 3 (noise), step 4 (collimation), step 5 (invert) and
// step 6 (flips and rotation).
//
// Sampling is the same as in the GPU shader: the ray is clipped to the
// volume's box, samples are taken at entry + (i + 0.5) × step, and each sample
// reads the nearest voxel.
import { IMAGE_SIZE_PX, createProjection, type Pixel, type Projection } from '../core/geometry';
import type { CArmPose, Vec3, Volume } from '../core/types';
import { addNoise, type NoiseOptions } from './noise';
import { orientPixel, unorientPixel, type Orientation, type Rotation } from './orientation';
import {
  ABSORPTION_PER_MM,
  MAGNIFICATIONS,
  MARCH_STEP_MM,
  MAX_MARCH_STEPS,
  NO_SIGNAL,
  detectorPosition,
  isCollimated,
  type Collimation,
  type Magnification,
} from './pipeline';

/** Options of the CPU reference. Later F2 stories add to this. */
export interface DrrCpuOptions {
  /** Step 1: 1, 1.5 or 2 (default 1). Structures appear this much larger around the image centre. */
  magnification?: Magnification;
  /** Step 3: seeded grain (default: none). Collimated pixels get none. */
  noise?: NoiseOptions;
  /** Step 4: the four shutters, each 0–50 % of the image from its edge (default: all open). */
  collimation?: Collimation;
  /** Display step 5: value → 1 − value (more absorption = lighter). */
  invert?: boolean;
  /** Display step 6: flip left-right (first). */
  flipHorizontal?: boolean;
  /** Display step 6: flip up-down (second). */
  flipVertical?: boolean;
  /** Display step 6: rotate clockwise by 0, 90, 180 or 270° (last; default 0). */
  rotation?: Rotation;
}

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

/** The magnification to use; anything but 1, 1.5 or 2 is an error. */
function magnificationOf(options: DrrCpuOptions): Magnification {
  const m = options.magnification ?? 1;
  if (!MAGNIFICATIONS.includes(m)) {
    throw new Error(`Unsupported magnification ${String(m)}: it must be 1, 1.5 or 2.`);
  }
  return m;
}

const OPEN: Collimation = { left: 0, right: 0, top: 0, bottom: 0 };

/** The shutters to use; a value outside 0–50 or one that is not a finite number is an error. */
function collimationOf(options: DrrCpuOptions): Collimation {
  const c = options.collimation ?? OPEN;
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const value = c[edge];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 50) {
      throw new Error(`Unsupported collimation: ${edge} is ${String(value)}, but it must be a number from 0 to 50.`);
    }
  }
  return c;
}

const NO_NOISE: NoiseOptions = { seed: 0, level: 0 };

/** The grain to use; a level outside 0…1 or a seed that is not a finite number is an error. */
function noiseOf(options: DrrCpuOptions): NoiseOptions {
  const noise = options.noise ?? NO_NOISE;
  if (!Number.isFinite(noise.seed)) {
    throw new Error(`Unsupported noise: the seed is ${String(noise.seed)}, but it must be a finite number.`);
  }
  if (!Number.isFinite(noise.level) || noise.level < 0 || noise.level > 1) {
    throw new Error(`Unsupported noise: the level is ${String(noise.level)}, but it must be a number from 0 to 1.`);
  }
  return noise;
}

/** The flips and rotation to use (a bad rotation is reported by orientPixel). */
function orientationOf(options: DrrCpuOptions): Orientation {
  const orientation: Orientation = {
    flipHorizontal: options.flipHorizontal ?? false,
    flipVertical: options.flipVertical ?? false,
    rotation: options.rotation ?? 0,
  };
  orientPixel({ x: 0, y: 0 }, orientation); // throws on an unsupported rotation
  return orientation;
}

const isUnchanged = (o: Orientation): boolean => !o.flipHorizontal && !o.flipVertical && o.rotation === 0;

/** The display steps that change a pixel's value (step 5, invert). */
const display = (value: number, options: DrrCpuOptions): number => (options.invert ? 1 - value : value);

/**
 * Fraction of the X-rays (0…1) that gets through the volume along the ray of
 * one pixel position of the image as shown (after magnification, flips and
 * rotation; e.g. { x: 255.5, y: 255.5 } for the centre of
 * pixel (255, 255)), shown inverted if options.invert is set. For checking
 * single rays quickly.
 */
export function transmissionAt(
  volume: Volume,
  projection: Projection,
  pixel: Pixel,
  options: DrrCpuOptions = {},
): number {
  assertStandardLayout(volume);
  const magnification = magnificationOf(options);
  const collimation = collimationOf(options);
  const noise = noiseOf(options);
  // Step 6 backwards: which position of the image as taken is shown at this pixel.
  pixel = unorientPixel(pixel, orientationOf(options), IMAGE_SIZE_PX);
  const x = Math.floor(pixel.x);
  const y = Math.floor(pixel.y);
  if (isCollimated(x, y, collimation)) return display(NO_SIGNAL, options);
  const value = march(volume, projection, detectorPosition(pixel, magnification));
  return display(addNoise(value, noise, x, y), options);
}

/** The whole 512×512 reference image of `volume` at `pose`. */
export function renderDrrCpu(volume: Volume, pose: CArmPose, options: DrrCpuOptions = {}): DrrImage {
  assertStandardLayout(volume);
  const magnification = magnificationOf(options);
  const collimation = collimationOf(options);
  const noise = noiseOf(options);
  const orientation = orientationOf(options);
  const projection = createProjection(pose);
  const width = IMAGE_SIZE_PX;
  const height = IMAGE_SIZE_PX;
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isCollimated(x, y, collimation)) {
        data[x + width * y] = display(NO_SIGNAL, options);
        continue;
      }
      const onDetector = detectorPosition({ x: x + 0.5, y: y + 0.5 }, magnification);
      data[x + width * y] = display(addNoise(march(volume, projection, onDetector), noise, x, y), options);
    }
  }
  if (isUnchanged(orientation)) return { width, height, data };

  // Step 6: move every pixel of the image as taken to where it is shown.
  const shown = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const to = orientPixel({ x, y }, orientation);
      shown[to.x + width * to.y] = data[x + width * y]!;
    }
  }
  return { width, height, data: shown };
}
