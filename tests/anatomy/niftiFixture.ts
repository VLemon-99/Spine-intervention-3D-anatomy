// Test helper: builds tiny NIfTI-1 files from an array, so tests never need
// real CT data. Lives in tests/ on purpose (not shipped, not used by tools).
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export const NIFTI_TYPE = { uint8: 2, int16: 4, float32: 16, uint16: 512 } as const;
export type NiftiTypeName = keyof typeof NIFTI_TYPE;

export interface NiftiFixtureOptions {
  /** Size along i, j, k. */
  dims: readonly [number, number, number];
  /** Voxel values as stored, in file order (i fastest). */
  data: ArrayLike<number>;
  type?: NiftiTypeName | number;
  spacing?: readonly [number, number, number];
  slope?: number;
  inter?: number;
  bigEndian?: boolean;
  /** Three rows of four numbers; sets sform_code = 1. */
  sform?: readonly (readonly number[])[];
  /** Quaternion b, c, d and offset x, y, z; sets qform_code = 1. */
  qform?: { b: number; c: number; d: number; offset: readonly [number, number, number]; qfac?: number };
  magic?: string;
  /** Override dim[] (all eight entries), e.g. to fake a 4-D file. */
  rawDim?: readonly number[];
  /** Drop this many bytes from the end of the file. */
  truncateBy?: number;
}

const BYTES: Record<number, number> = { 2: 1, 4: 2, 16: 4, 512: 2 };

export function makeNifti(o: NiftiFixtureOptions): Buffer {
  const type = typeof o.type === 'number' ? o.type : NIFTI_TYPE[o.type ?? 'int16'];
  const bytesPer = BYTES[type] ?? 2;
  const le = !o.bigEndian;
  const voxOffset = 352;
  const buf = Buffer.alloc(voxOffset + o.data.length * bytesPer);
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const spacing = o.spacing ?? [1, 1, 1];

  v.setInt32(0, 348, le);
  const dim = o.rawDim ?? [3, o.dims[0], o.dims[1], o.dims[2], 1, 1, 1, 1];
  dim.forEach((d, n) => v.setInt16(40 + 2 * n, d, le));
  v.setInt16(70, type, le);
  v.setInt16(72, bytesPer * 8, le);
  const qfac = o.qform?.qfac ?? 1;
  [qfac, spacing[0], spacing[1], spacing[2], 1, 1, 1, 1].forEach((p, n) => v.setFloat32(76 + 4 * n, p, le));
  v.setFloat32(108, voxOffset, le);
  v.setFloat32(112, o.slope ?? 1, le);
  v.setFloat32(116, o.inter ?? 0, le);
  if (o.qform) {
    v.setInt16(252, 1, le);
    v.setFloat32(256, o.qform.b, le);
    v.setFloat32(260, o.qform.c, le);
    v.setFloat32(264, o.qform.d, le);
    o.qform.offset.forEach((x, n) => v.setFloat32(268 + 4 * n, x, le));
  }
  if (o.sform) {
    v.setInt16(254, 1, le);
    o.sform.forEach((row, r) => row.forEach((x, c) => v.setFloat32(280 + 16 * r + 4 * c, x, le)));
  }
  buf.write((o.magic ?? 'n+1\0').padEnd(4, '\0').slice(0, 4), 344, 'latin1');

  for (let n = 0; n < o.data.length; n++) {
    const at = voxOffset + n * bytesPer;
    const x = o.data[n];
    if (type === 2) v.setUint8(at, x);
    else if (type === 4) v.setInt16(at, x, le);
    else if (type === 512) v.setUint16(at, x, le);
    else if (type === 16) v.setFloat32(at, x, le);
  }
  return o.truncateBy ? buf.subarray(0, buf.length - o.truncateBy) : buf;
}

/** Writes the fixture to `path`; gzips it when the path ends in `.gz`. */
export function writeNifti(path: string, o: NiftiFixtureOptions): void {
  const raw = makeNifti(o);
  writeFileSync(path, path.endsWith('.gz') ? gzipSync(raw) : raw);
}
