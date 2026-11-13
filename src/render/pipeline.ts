// The numbers and the ORDER OF STEPS that the two X-ray renderers share
// (docs/SPEC.md F2): the GPU shader (drrGpu.ts) and the CPU reference
// (drrCpu.ts). Both must follow this order exactly, or their images differ.
//
// ORDER OF STEPS
//
// A. Taking the image (the result is frozen until the next exposure)
//   1. Magnification m (1, 1.5 or 2): image pixel p looks at the detector
//      position  centre + (p − centre) / m,  with centre = (256, 256).
//   2. Absorption: a ray runs from the X-ray source through that detector
//      position. Along the part inside the volume's box, samples are taken at
//      entry + (i + 0.5) × MARCH_STEP_MM (nearest voxel), and
//        total = sum of (intensity / 255 × ABSORPTION_PER_MM
//                        + extra / 255 × EXTRA_ABSORPTION_PER_MM) × step
//        value = e^(−total)          (1 = full brightness, 0 = black)
//      `extra` is the optional extra absorption volume (contrast, F2.8).
//   3. Noise: seeded grain is added, and the result is kept within 0…1.
//   4. Collimation: pixels outside the open area get the fixed "no signal"
//      value, and no noise.
//
// B. Displaying the held image (applied straight away, no new exposure)
//   5. Invert: value → 1 − value.
//   6. Orientation: flip left-right, then flip up-down, then rotate clockwise
//      by 0°, 90°, 180° or 270°.
//
// Each later F2 story switches on one of these steps; this file gains the
// numbers they need (EXTRA_ABSORPTION_PER_MM, NO_SIGNAL, noise levels).

import { IMAGE_SIZE_PX, type Pixel } from '../core/geometry';

/** Distance between samples along each ray, mm (half a phantom voxel). */
export const MARCH_STEP_MM = 0.5;

/**
 * Absorption per mm of a voxel with full intensity (255). Chosen so that about
 * 8 cm of soft tissue lets roughly half the X-rays through and bone shows
 * clearly darker. A display setting, not a physical constant.
 */
export const ABSORPTION_PER_MM = 0.025;

/** Most samples taken along one ray (the GPU shader's fixed loop limit). */
export const MAX_MARCH_STEPS = 4096;

/** The magnification settings on offer. */
export const MAGNIFICATIONS = [1, 1.5, 2] as const;
export type Magnification = (typeof MAGNIFICATIONS)[number];

/**
 * Step 1: the detector position that image pixel position `pixel` looks at,
 * at magnification m. Structures appear m times larger around the image centre.
 */
export function detectorPosition(pixel: Pixel, magnification: number): Pixel {
  const centre = IMAGE_SIZE_PX / 2;
  return {
    x: centre + (pixel.x - centre) / magnification,
    y: centre + (pixel.y - centre) / magnification,
  };
}

/** Step 4: the fixed "no signal" value of pixels covered by a shutter (black). */
export const NO_SIGNAL = 0;

/** Each shutter: the percentage of the image it covers from that edge, 0–50. */
export interface Collimation {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Step 4: is image pixel (x, y) — whole numbers, (0, 0) at the top-left —
 * covered by a shutter? Measured on the image as taken (after magnification,
 * before any flip or rotation). left = 20 covers the columns x < 0.2 × 512;
 * the other three edges work the same way, counted from their own edge.
 */
export function isCollimated(x: number, y: number, collimation: Collimation): boolean {
  const last = IMAGE_SIZE_PX - 1;
  const covered = (fromEdge: number, percent: number): boolean => fromEdge < (percent / 100) * IMAGE_SIZE_PX;
  return (
    covered(x, collimation.left) ||
    covered(last - x, collimation.right) ||
    covered(y, collimation.top) ||
    covered(last - y, collimation.bottom)
  );
}

/**
 * Step 3: the most the grain can change a pixel's value (0…1 scale) at noise
 * level 1. At level L a pixel changes by at most ± NOISE_AMPLITUDE × L.
 */
export const NOISE_AMPLITUDE = 0.25;

/**
 * Default noise levels: a continuous-fluoro frame is grainier than a single
 * shot. A look-and-feel choice the owner may tune; the shot level is kept
 * small (about ± 2.5 grey levels of 255).
 */
export const DEFAULT_NOISE_LEVEL = { shot: 0.04, fluoro: 0.1 } as const;

export function defaultNoiseLevel(kind: 'shot' | 'fluoro'): number {
  return DEFAULT_NOISE_LEVEL[kind];
}

/**
 * Step 2: absorption per mm of a voxel of the extra absorption volume at full
 * strength (255) — used for contrast (F2.8, F9). Chosen so a few millimetres
 * of full-strength contrast is clearly darker than soft tissue (3 mm lets
 * about 40% through). A display number that F9 or the owner may tune.
 */
export const EXTRA_ABSORPTION_PER_MM = 0.3;

/**
 * The noise level an image is actually taken with (F2.6). A single shot (or an
 * image of unknown kind) uses the setting as it is. A continuous-fluoro frame
 * is grainier: the setting × (default fluoro level ÷ default shot level), kept
 * within 0…1.
 */
export function noiseLevelFor(kind: 'shot' | 'fluoro' | null, setting: number): number {
  if (kind !== 'fluoro') return setting;
  const ratio = DEFAULT_NOISE_LEVEL.fluoro / DEFAULT_NOISE_LEVEL.shot;
  return Math.min(1, Math.max(0, setting * ratio));
}

// Step 2b: the needle (F7). Its metal absorbs on top of step 2, along the
// whole ray from the source to the detector position, also outside the
// volume's box:
//   total += needlePathLength(source, ray direction, resampleShaft(shaft))
//            × NEEDLE_ABSORPTION_PER_MM

/**
 * Radius of the needle's metal tube, mm. The same for every needle (owner
 * decision 2026-11-13): the renderer cannot read the needle catalogue. Draft.
 */
export const NEEDLE_RADIUS_MM = 0.35;

/**
 * Absorption per mm of needle metal. Draft, chosen so the needle is clearly
 * darker than bone: one needle diameter (0.7 mm) absorbs 2.1, letting about
 * 12% through, while a ray through a phantom vertebra body absorbs only about
 * 0.3 more than soft tissue. A display number the owner may tune.
 */
export const NEEDLE_ABSORPTION_PER_MM = 3;

/** Most straight pieces the needle curve is split into (the GPU shader's limit). */
export const MAX_NEEDLE_SEGMENTS = 64;

interface ShaftPoint {
  x: number;
  y: number;
  z: number;
}

const distance = (a: ShaftPoint, b: ShaftPoint): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const copyPoint = (p: ShaftPoint): ShaftPoint => ({ x: p.x, y: p.y, z: p.z });

/**
 * The shaft curve (hub → tip) as MAX_NEEDLE_SEGMENTS + 1 points evenly spaced
 * along its length, keeping the hub and the tip exactly. No points → none;
 * one point, or a curve of zero length → that one point.
 */
export function resampleShaft(points: readonly ShaftPoint[]): ShaftPoint[] {
  if (points.length === 0) return [];
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  const total = cumulative[cumulative.length - 1];
  if (points.length === 1 || total === 0) return [copyPoint(points[0])];

  const out: ShaftPoint[] = [copyPoint(points[0])];
  let piece = 1; // points[piece - 1] → points[piece] holds the current target length
  for (let s = 1; s < MAX_NEEDLE_SEGMENTS; s++) {
    const target = (s / MAX_NEEDLE_SEGMENTS) * total;
    while (cumulative[piece] < target) piece++;
    const a = points[piece - 1];
    const b = points[piece];
    const length = cumulative[piece] - cumulative[piece - 1];
    const f = length > 0 ? (target - cumulative[piece - 1]) / length : 0;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
  }
  out.push(copyPoint(points[points.length - 1]));
  return out;
}

/** Below this, a squared length counts as zero (parallel ray, zero-length piece). */
const TINY = 1e-12;

/**
 * Length (mm) of the ray rayOrigin + t × rayDir, t ≥ 0, inside the needle:
 * a tube of radius NEEDLE_RADIUS_MM with flat ends around each straight piece
 * between consecutive points. Per piece: the stretch of the ray within
 * NEEDLE_RADIUS_MM of the piece's axis line, cut to where it lies alongside
 * the piece. So a ray along the piece's own line gets the piece's length, and
 * no chord is longer than the piece length plus a diameter. rayDir need not
 * be of unit length. An empty or one-point shaft gives 0.
 */
export function needlePathLength(rayOrigin: ShaftPoint, rayDir: ShaftPoint, points: readonly ShaftPoint[]): number {
  const dirLength = Math.hypot(rayDir.x, rayDir.y, rayDir.z);
  if (points.length < 2 || dirLength === 0) return 0;
  const dx = rayDir.x / dirLength;
  const dy = rayDir.y / dirLength;
  const dz = rayDir.z / dirLength;
  const r2 = NEEDLE_RADIUS_MM * NEEDLE_RADIUS_MM;
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    let ux = b.x - a.x;
    let uy = b.y - a.y;
    let uz = b.z - a.z;
    const length = Math.hypot(ux, uy, uz);
    if (length * length < TINY) continue;
    ux /= length;
    uy /= length;
    uz /= length;

    // Ray start relative to the piece's start: along the axis (s0) and across it (w).
    const ox = rayOrigin.x - a.x;
    const oy = rayOrigin.y - a.y;
    const oz = rayOrigin.z - a.z;
    const s0 = ox * ux + oy * uy + oz * uz;
    const du = dx * ux + dy * uy + dz * uz;
    const wx = ox - s0 * ux;
    const wy = oy - s0 * uy;
    const wz = oz - s0 * uz;
    const px = dx - du * ux;
    const py = dy - du * uy;
    const pz = dz - du * uz;

    // Within the radius of the axis line: |w + t p|² ≤ r².
    let tMin = 0;
    let tMax = Infinity;
    const qa = px * px + py * py + pz * pz;
    const qb = 2 * (wx * px + wy * py + wz * pz);
    const qc = wx * wx + wy * wy + wz * wz - r2;
    if (qa < TINY) {
      if (qc > 0) continue;
    } else {
      const disc = qb * qb - 4 * qa * qc;
      if (disc <= 0) continue;
      const root = Math.sqrt(disc);
      tMin = Math.max(tMin, (-qb - root) / (2 * qa));
      tMax = Math.min(tMax, (-qb + root) / (2 * qa));
    }

    // Alongside the piece: 0 ≤ s0 + t × du ≤ length.
    if (Math.abs(du) < 1e-9) {
      if (s0 < 0 || s0 > length) continue;
    } else {
      const t1 = -s0 / du;
      const t2 = (length - s0) / du;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    }

    if (tMax > tMin) total += tMax - tMin;
  }
  return total;
}
