// Reorder a NIfTI volume into the app's one standard layout (owner decision 2026-11-10):
// voxel axis i → patient's left (+x), j → back (+y), k → head (+z), i.e. identity orientation.
//
// NIfTI affines are in RAS (x = patient's right, y = front, z = head), so
// app x = −RAS x, app y = −RAS y, app z = RAS z.
// CT and mask volumes go through the same plan, so they always line up.

export interface Size3 {
  x: number;
  y: number;
  z: number;
}

export interface StoredVolume<T extends Float32Array | Uint8Array> {
  size: Size3;
  /** 4×4 (or 3×4) rows: voxel index (i, j, k, 1) → RAS mm. */
  affine: readonly (readonly number[])[];
  data: T;
}

export interface StandardVolume<T extends Float32Array | Uint8Array> {
  size: Size3;
  spacing: Size3;
  /** Patient position (mm, app frame) of the centre of voxel (0, 0, 0). */
  origin: Size3;
  data: T;
}

/** How each output axis is read from the stored axes. */
export interface LayoutPlan {
  /** For output axis p (x, y, z): the stored axis it comes from (0, 1, 2). */
  fromAxis: [number, number, number];
  /** For output axis p: true if the stored axis runs the opposite way. */
  flipped: [boolean, boolean, boolean];
  inSize: [number, number, number];
  outSize: Size3;
  spacing: Size3;
  origin: Size3;
}

/** Largest angle (degrees) a stored axis may be away from a patient axis. */
export const MAX_AXIS_TILT_DEG = 5;

const AXES = ['x', 'y', 'z'] as const;
const PATIENT_DIR = ['left/right', 'back/front', 'head/foot'];

/** Works out the reordering from the size and affine; throws on oblique or degenerate scans. */
export function planStandardLayout(size: Size3, affine: readonly (readonly number[])[]): LayoutPlan {
  if (affine.length < 3 || affine.slice(0, 3).some((r) => r.length < 4 || r.some((v) => !Number.isFinite(v)))) {
    throw new Error('Volume affine must have three rows of four finite numbers');
  }
  // Affine rows in the app frame.
  const app = affine.slice(0, 3).map((row, r) => row.map((v) => (r < 2 ? -v : v)));
  const inSize: [number, number, number] = [size.x, size.y, size.z];
  const fromAxis: [number, number, number] = [-1, -1, -1];
  const flipped: [boolean, boolean, boolean] = [false, false, false];
  const spacingArr = [0, 0, 0];

  for (let a = 0; a < 3; a++) {
    const col = [app[0][a], app[1][a], app[2][a]];
    const len = Math.hypot(col[0], col[1], col[2]);
    if (!(len > 0)) throw new Error(`Volume affine: stored axis ${a} has zero length`);
    let p = 0;
    for (let q = 1; q < 3; q++) if (Math.abs(col[q]) > Math.abs(col[p])) p = q;
    const tiltDeg = (Math.acos(Math.min(1, Math.abs(col[p]) / len)) * 180) / Math.PI;
    if (tiltDeg > MAX_AXIS_TILT_DEG) {
      throw new Error(
        `Oblique scan: stored axis ${a} is tilted ${tiltDeg.toFixed(1)}° from the nearest patient axis ` +
          `(${PATIENT_DIR[p]}); more than ${MAX_AXIS_TILT_DEG}° is not supported`,
      );
    }
    if (fromAxis[p] !== -1) {
      throw new Error(`Volume affine: two stored axes both point ${PATIENT_DIR[p]}`);
    }
    fromAxis[p] = a;
    flipped[p] = col[p] < 0;
    spacingArr[p] = len;
  }

  // Stored index of output voxel (0, 0, 0), then its position in the app frame.
  const corner = [0, 0, 0];
  for (let p = 0; p < 3; p++) corner[fromAxis[p]] = flipped[p] ? inSize[fromAxis[p]] - 1 : 0;
  const pos = app.map((row) => row[0] * corner[0] + row[1] * corner[1] + row[2] * corner[2] + row[3]);

  return {
    fromAxis,
    flipped,
    inSize,
    outSize: { x: inSize[fromAxis[0]], y: inSize[fromAxis[1]], z: inSize[fromAxis[2]] },
    spacing: { x: spacingArr[0], y: spacingArr[1], z: spacingArr[2] },
    origin: { x: pos[0], y: pos[1], z: pos[2] },
  };
}

/** Applies a plan to one voxel array (same plan for the CT and every mask). */
export function applyLayoutPlan<T extends Float32Array | Uint8Array>(plan: LayoutPlan, data: T): T {
  const [sx, sy, sz] = plan.inSize;
  if (data.length !== sx * sy * sz) {
    throw new Error(`Voxel array has ${data.length} values but the volume size needs ${sx * sy * sz}`);
  }
  const Ctor = data.constructor as new (n: number) => T;
  const out = new Ctor(data.length);
  const { x: nx, y: ny, z: nz } = plan.outSize;
  const strides = [1, sx, sx * sy];
  // Per output axis: stored stride, and where along it the output index starts.
  const stride = AXES.map((_, p) => strides[plan.fromAxis[p]] * (plan.flipped[p] ? -1 : 1));
  const start = AXES.map((_, p) => (plan.flipped[p] ? (plan.inSize[plan.fromAxis[p]] - 1) * strides[plan.fromAxis[p]] : 0));
  const base = start[0] + start[1] + start[2];
  let n = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      let src = base + j * stride[1] + k * stride[2];
      for (let i = 0; i < nx; i++) {
        out[n++] = data[src];
        src += stride[0];
      }
    }
  }
  return out;
}

/** Plans and reorders one volume. */
export function toStandardLayout<T extends Float32Array | Uint8Array>(vol: StoredVolume<T>): StandardVolume<T> {
  const plan = planStandardLayout(vol.size, vol.affine);
  return { size: plan.outSize, spacing: plan.spacing, origin: plan.origin, data: applyLayoutPlan(plan, vol.data) };
}
