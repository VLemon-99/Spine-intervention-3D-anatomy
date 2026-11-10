// Small NIfTI-1 reader for the anatomy converter (Node only, built-in modules only).
// Reads single-file NIfTI (.nii) plain or gzipped (.nii.gz), 3-D volumes of the
// types CT scans and masks use. Anything else is rejected with an error naming the file.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { gunzipSync } from 'node:zlib';

export interface NiftiVolume {
  /** Number of voxels along the file's i, j, k axes. */
  size: { x: number; y: number; z: number };
  /** Voxel size in mm along i, j, k (from pixdim). */
  spacing: { x: number; y: number; z: number };
  /**
   * 4×4 matrix (rows) turning voxel indices (i, j, k, 1) into scanner
   * millimetres in the NIfTI RAS+ convention (+x right, +y front, +z head).
   */
  affine: number[][];
  /** Where the affine came from: the sform, the qform, or spacing only ('none'). */
  affineSource: 'sform' | 'qform' | 'none';
  /** Voxel values with scl_slope / scl_inter applied; index i + nx * (j + ny * k). */
  data: Float32Array;
}

const HEADER_SIZE = 348;
const BYTES_PER_VOXEL: Record<number, number> = { 2: 1, 4: 2, 16: 4, 512: 2 };
const TYPE_NAMES: Record<number, string> = { 2: 'unsigned 8-bit', 4: 'signed 16-bit', 16: '32-bit float', 512: 'unsigned 16-bit' };

export function readNifti(path: string): NiftiVolume {
  return parseNifti(readFileSync(path), basename(path));
}

/** Parses NIfTI bytes (gzipped or not). `name` is used in error messages. */
export function parseNifti(input: Uint8Array, name: string): NiftiVolume {
  const fail = (why: string): never => {
    throw new Error(`NIfTI file "${name}": ${why}`);
  };

  let bytes = input;
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = gunzipSync(bytes);
    } catch (e) {
      fail(`could not be un-gzipped (${(e as Error).message}); the file may be cut short or damaged`);
    }
  }
  if (bytes.length < HEADER_SIZE) fail(`only ${bytes.length} bytes, shorter than the ${HEADER_SIZE}-byte header`);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let le = true;
  if (view.getInt32(0, true) !== HEADER_SIZE) {
    if (view.getInt32(0, false) === HEADER_SIZE) le = false;
    else fail(`wrong header size (expected ${HEADER_SIZE}); not a NIfTI-1 file`);
  }

  const magic = String.fromCharCode(bytes[344], bytes[345], bytes[346], bytes[347]);
  if (magic === 'ni1\0') fail('is a two-file NIfTI (.hdr/.img); only single-file .nii or .nii.gz is supported');
  if (magic !== 'n+1\0') fail(`wrong magic text ${JSON.stringify(magic)} (expected "n+1")`);

  const i16 = (at: number) => view.getInt16(at, le);
  const f32 = (at: number) => view.getFloat32(at, le);

  const ndim = i16(40);
  if (ndim < 1 || ndim > 7) fail(`invalid number of dimensions (${ndim})`);
  const dim = Array.from({ length: 7 }, (_, n) => (n < ndim ? i16(42 + 2 * n) : 1));
  if (dim.some((d) => d < 1)) fail(`invalid dimension sizes ${JSON.stringify(dim.slice(0, ndim))}`);
  if (dim.slice(3).some((d) => d > 1)) {
    fail(`has more than 3 dimensions with size > 1 (${dim.slice(0, ndim).join('×')}); only 3-D volumes are supported`);
  }
  const [nx, ny, nz] = dim;

  const datatype = i16(70);
  const bytesPer = BYTES_PER_VOXEL[datatype];
  if (!bytesPer) {
    fail(`unsupported data type code ${datatype} (supported: ${Object.values(TYPE_NAMES).join(', ')})`);
  }

  const pixdim = Array.from({ length: 4 }, (_, n) => f32(76 + 4 * n));
  const spacing = { x: Math.abs(pixdim[1]), y: Math.abs(pixdim[2]), z: Math.abs(pixdim[3]) };

  const voxOffset = Math.max(HEADER_SIZE, Math.floor(f32(108)));
  const count = nx * ny * nz;
  const needed = voxOffset + count * bytesPer;
  if (bytes.length < needed) {
    fail(`file is shorter than the header says: ${bytes.length} bytes, but ${needed} are needed for ${nx}×${ny}×${nz} voxels`);
  }

  let slope = f32(112);
  let inter = f32(116);
  if (!Number.isFinite(slope) || slope === 0) {
    slope = 1;
    inter = 0;
  }
  if (!Number.isFinite(inter)) inter = 0;

  const data = new Float32Array(count);
  for (let n = 0; n < count; n++) {
    const at = voxOffset + n * bytesPer;
    let raw: number;
    if (datatype === 2) raw = view.getUint8(at);
    else if (datatype === 4) raw = view.getInt16(at, le);
    else if (datatype === 512) raw = view.getUint16(at, le);
    else raw = view.getFloat32(at, le);
    data[n] = raw * slope + inter;
  }

  const { affine, affineSource } = readAffine(i16, f32, pixdim);
  return { size: { x: nx, y: ny, z: nz }, spacing, affine, affineSource, data };
}

function readAffine(
  i16: (at: number) => number,
  f32: (at: number) => number,
  pixdim: number[],
): { affine: number[][]; affineSource: NiftiVolume['affineSource'] } {
  const last = [0, 0, 0, 1];
  if (i16(254) > 0) {
    const rows = [0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => f32(280 + 16 * r + 4 * c)));
    return { affine: [...rows, last], affineSource: 'sform' };
  }
  if (i16(252) > 0) {
    // NIfTI-1 "method 2": rotation from the quaternion (b, c, d), a = sqrt(1 − b² − c² − d²).
    const b = f32(256);
    const c = f32(260);
    const d = f32(264);
    const a = Math.sqrt(Math.max(0, 1 - (b * b + c * c + d * d)));
    const qfac = pixdim[0] < 0 ? -1 : 1;
    const R = [
      [a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)],
      [2 * (b * c + a * d), a * a + c * c - b * b - d * d, 2 * (c * d - a * b)],
      [2 * (b * d - a * c), 2 * (c * d + a * b), a * a + d * d - c * c - b * b],
    ];
    const scale = [Math.abs(pixdim[1]), Math.abs(pixdim[2]), Math.abs(pixdim[3]) * qfac];
    const offset = [f32(268), f32(272), f32(276)];
    const rows = R.map((row, r) => [...row.map((x, col) => x * scale[col]), offset[r]]);
    return { affine: [...rows, last], affineSource: 'qform' };
  }
  // NIfTI-1 "method 1": spacing only, no position or direction information.
  return {
    affine: [
      [Math.abs(pixdim[1]), 0, 0, 0],
      [0, Math.abs(pixdim[2]), 0, 0],
      [0, 0, Math.abs(pixdim[3]), 0],
      last,
    ],
    affineSource: 'none',
  };
}
