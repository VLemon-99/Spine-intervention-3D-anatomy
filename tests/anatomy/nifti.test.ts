import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNifti } from '../../tools/anatomy/nifti';
import { writeNifti } from './niftiFixture';

const dir = mkdtempSync(join(tmpdir(), 'nifti-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// 4×3×2 = 24 voxels, signed values including negatives.
const dims = [4, 3, 2] as const;
const values = Array.from({ length: 24 }, (_, n) => n * 50 - 600);
const spacing = [0.8, 1.25, 2.5] as const;

describe('readNifti', () => {
  it('reads a 4×3×2 signed 16-bit .nii file with the right size, spacing and every voxel value', () => {
    const path = join(dir, 'ct.nii');
    writeNifti(path, { dims, data: values, type: 'int16', spacing });
    const vol = readNifti(path);
    expect(vol.size).toEqual({ x: 4, y: 3, z: 2 });
    expect(vol.spacing.x).toBeCloseTo(0.8, 5);
    expect(vol.spacing.y).toBeCloseTo(1.25, 5);
    expect(vol.spacing.z).toBeCloseTo(2.5, 5);
    expect(Array.from(vol.data)).toEqual(values);
  });

  it('reads the same file gzipped (.nii.gz) identically', () => {
    const plain = join(dir, 'same.nii');
    const gz = join(dir, 'same.nii.gz');
    writeNifti(plain, { dims, data: values, type: 'int16', spacing });
    writeNifti(gz, { dims, data: values, type: 'int16', spacing });
    const a = readNifti(plain);
    const b = readNifti(gz);
    expect(b.size).toEqual(a.size);
    expect(b.spacing).toEqual(a.spacing);
    expect(b.affine).toEqual(a.affine);
    expect(Array.from(b.data)).toEqual(Array.from(a.data));
  });

  it('applies the header scale and offset (stored 100, slope 2, intercept −1024 → −824)', () => {
    const path = join(dir, 'scaled.nii');
    writeNifti(path, { dims: [1, 1, 1], data: [100], type: 'int16', slope: 2, inter: -1024 });
    expect(readNifti(path).data[0]).toBe(-824);
  });

  it('treats a slope of 0 as "no scaling", as the NIfTI standard says', () => {
    const path = join(dir, 'noscale.nii');
    writeNifti(path, { dims: [1, 1, 1], data: [100], type: 'int16', slope: 0, inter: 5 });
    expect(readNifti(path).data[0]).toBe(100);
  });

  it('reads unsigned 8-bit files', () => {
    const path = join(dir, 'mask.nii');
    const data = Array.from({ length: 24 }, (_, n) => (n * 11) % 256);
    writeNifti(path, { dims, data, type: 'uint8' });
    expect(Array.from(readNifti(path).data)).toEqual(data);
  });

  it('reads unsigned 16-bit files', () => {
    const path = join(dir, 'u16.nii');
    const data = Array.from({ length: 24 }, (_, n) => n * 2700);
    writeNifti(path, { dims, data, type: 'uint16' });
    expect(Array.from(readNifti(path).data)).toEqual(data);
  });

  it('reads 32-bit float files', () => {
    const path = join(dir, 'float.nii');
    const data = Array.from({ length: 24 }, (_, n) => n * 0.5 - 3.25);
    writeNifti(path, { dims, data, type: 'float32' });
    expect(Array.from(readNifti(path).data)).toEqual(data);
  });

  it('reads a big-endian file', () => {
    const path = join(dir, 'big.nii.gz');
    writeNifti(path, { dims, data: values, type: 'int16', spacing, bigEndian: true, slope: 2, inter: -1024 });
    const vol = readNifti(path);
    expect(vol.size).toEqual({ x: 4, y: 3, z: 2 });
    expect(vol.spacing.z).toBeCloseTo(2.5, 5);
    expect(Array.from(vol.data)).toEqual(values.map((x) => x * 2 - 1024));
  });

  it('reads a big-endian 32-bit float file', () => {
    const path = join(dir, 'bigfloat.nii');
    const data = [1.5, -2.25, 1000.125];
    writeNifti(path, { dims: [3, 1, 1], data, type: 'float32', bigEndian: true });
    expect(Array.from(readNifti(path).data)).toEqual(data);
  });

  it('returns the sform affine when the file has one', () => {
    const path = join(dir, 'sform.nii');
    const sform = [
      [-0.8, 0, 0, 10],
      [0, -1.25, 0, 20],
      [0, 0, 2.5, -30],
    ];
    writeNifti(path, { dims, data: values, spacing, sform, qform: { b: 0, c: 0, d: 1, offset: [1, 2, 3] } });
    const vol = readNifti(path);
    expect(vol.affineSource).toBe('sform');
    // Header numbers are 32-bit floats, so compare with the 32-bit-rounded values.
    expect(vol.affine).toEqual([...sform.map((row) => row.map(Math.fround)), [0, 0, 0, 1]]);
  });

  it('builds the affine from the qform when there is no sform', () => {
    // b = c = 0, d = 1 is a 180° turn about the k axis: i → −x, j → −y.
    const path = join(dir, 'qform.nii');
    writeNifti(path, { dims, data: values, spacing: [2, 3, 4], qform: { b: 0, c: 0, d: 1, offset: [5, 6, 7] } });
    const vol = readNifti(path);
    expect(vol.affineSource).toBe('qform');
    const expected = [
      [-2, 0, 0, 5],
      [0, -3, 0, 6],
      [0, 0, 4, 7],
      [0, 0, 0, 1],
    ];
    vol.affine.forEach((row, r) => row.forEach((x, c) => expect(x).toBeCloseTo(expected[r][c], 5)));
  });

  it('flips the k axis when the qform qfac is −1', () => {
    const path = join(dir, 'qfac.nii');
    writeNifti(path, { dims, data: values, spacing: [1, 1, 2], qform: { b: 0, c: 0, d: 0, offset: [0, 0, 0], qfac: -1 } });
    const vol = readNifti(path);
    expect(vol.affine[2][2]).toBeCloseTo(-2, 5);
    expect(vol.spacing.z).toBeCloseTo(2, 5);
  });

  it('falls back to a spacing-only affine when the file has neither sform nor qform', () => {
    const path = join(dir, 'plain-affine.nii');
    writeNifti(path, { dims, data: values, spacing: [2, 3, 4] });
    const vol = readNifti(path);
    expect(vol.affineSource).toBe('none');
    expect(vol.affine).toEqual([
      [2, 0, 0, 0],
      [0, 3, 0, 0],
      [0, 0, 4, 0],
      [0, 0, 0, 1],
    ]);
  });

  it('accepts a 4-D header whose 4th size is 1', () => {
    const path = join(dir, 'fourd1.nii');
    writeNifti(path, { dims, data: values, rawDim: [4, 4, 3, 2, 1, 1, 1, 1] });
    expect(readNifti(path).size).toEqual({ x: 4, y: 3, z: 2 });
  });

  describe('rejects bad files with an error that names the file', () => {
    it('wrong magic text', () => {
      const path = join(dir, 'badmagic.nii');
      writeNifti(path, { dims, data: values, magic: 'xyz\0' });
      expect(() => readNifti(path)).toThrow(/badmagic\.nii/);
      expect(() => readNifti(path)).toThrow(/magic/i);
    });

    it('wrong header size', () => {
      const path = join(dir, 'badsize.nii');
      const raw = Buffer.alloc(400);
      raw.writeInt32LE(123, 0);
      writeFileSync(path, raw);
      expect(() => readNifti(path)).toThrow(/badsize\.nii/);
      expect(() => readNifti(path)).toThrow(/header size/i);
    });

    it('unsupported data type', () => {
      const path = join(dir, 'badtype.nii');
      writeNifti(path, { dims, data: values, type: 64 }); // 64 = 64-bit float
      expect(() => readNifti(path)).toThrow(/badtype\.nii/);
      expect(() => readNifti(path)).toThrow(/data type/i);
    });

    it('fewer bytes than the header promises', () => {
      const path = join(dir, 'short.nii.gz');
      writeNifti(path, { dims, data: values, truncateBy: 5 });
      expect(() => readNifti(path)).toThrow(/short\.nii\.gz/);
      expect(() => readNifti(path)).toThrow(/shorter|bytes/i);
    });

    it('a file shorter than the header itself', () => {
      const path = join(dir, 'tiny.nii');
      writeFileSync(path, Buffer.alloc(100));
      expect(() => readNifti(path)).toThrow(/tiny\.nii/);
    });

    it('more than 3 dimensions with size > 1', () => {
      const path = join(dir, 'fourd.nii');
      writeNifti(path, { dims, data: [...values, ...values], rawDim: [4, 4, 3, 2, 2, 1, 1, 1] });
      expect(() => readNifti(path)).toThrow(/fourd\.nii/);
      expect(() => readNifti(path)).toThrow(/dimension/i);
    });
  });
});

