import { describe, expect, it } from 'vitest';
import { createProjection } from '../../src/core/geometry';
import { createPhantom } from '../../src/core/phantom';
import type { CArmPose, Volume } from '../../src/core/types';
import { renderDrrCpu, transmissionAt } from '../../src/render/drrCpu';
import { ABSORPTION_PER_MM, EXTRA_ABSORPTION_PER_MM } from '../../src/render/pipeline';

const POSE: CArmPose = { oblique: 20, tilt: -10, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const phantom = createPhantom();
const voxels = phantom.intensity.length;
const plain = renderDrrCpu(phantom, POSE);

/**
 * An extra volume on the phantom's grid with a small blob (5 × 4 × 6 voxels)
 * of the given strength in the soft tissue to the patient's left of the spine.
 */
function blob(strength: number): Uint8Array {
  const { x: nx, y: ny } = phantom.size;
  const extra = new Uint8Array(voxels);
  for (let k = 60; k < 66; k++) for (let j = 50; j < 54; j++) for (let i = 72; i < 77; i++) extra[i + nx * (j + ny * k)] = strength;
  return extra;
}

/** The same grid as the phantom, but empty: only the extra volume absorbs. */
const emptyVolume: Volume = { ...phantom, intensity: new Uint8Array(voxels) };

/**
 * Which pixels' rays sample at least one blob voxel: rendered with nothing
 * else in the beam, exactly those pixels are below full brightness.
 */
const crossesBlob = renderDrrCpu(emptyVolume, POSE, { extraAbsorption: blob(255) }).data.map((v) => (v < 1 ? 1 : 0));

describe('EXTRA_ABSORPTION_PER_MM', () => {
  it('makes a few millimetres of full-strength contrast clearly darker than soft tissue', () => {
    expect(EXTRA_ABSORPTION_PER_MM).toBeGreaterThan(ABSORPTION_PER_MM);
    // 3 mm of full-strength contrast lets less than two thirds of the X-rays through.
    expect(Math.exp(-EXTRA_ABSORPTION_PER_MM * 3)).toBeLessThan(0.67);
  });
});

describe('extra absorption volume in the CPU reference', () => {
  it('darkens exactly the pixels whose rays cross the blob; every other pixel is unchanged', () => {
    const crossing = crossesBlob.reduce((n: number, v) => n + v, 0);
    expect(crossing).toBeGreaterThan(20);
    expect(crossing).toBeLessThan(5000);

    const image = renderDrrCpu(phantom, POSE, { extraAbsorption: blob(255) });
    let notDarker = 0;
    let changedElsewhere = 0;
    for (let i = 0; i < image.data.length; i++) {
      if (crossesBlob[i]) {
        if (!(image.data[i]! < plain.data[i]!)) notDarker += 1;
      } else if (image.data[i] !== plain.data[i]) {
        changedElsewhere += 1;
      }
    }
    expect(notDarker).toBe(0);
    expect(changedElsewhere).toBe(0);
  });

  it('an all-zero extra volume gives the identical image', () => {
    expect(renderDrrCpu(phantom, POSE, { extraAbsorption: new Uint8Array(voxels) }).data).toEqual(plain.data);
  });

  it('a stronger blob gives darker pixels', () => {
    const weak = renderDrrCpu(phantom, POSE, { extraAbsorption: blob(60) });
    const medium = renderDrrCpu(phantom, POSE, { extraAbsorption: blob(140) });
    const strong = renderDrrCpu(phantom, POSE, { extraAbsorption: blob(255) });
    let wrong = 0;
    for (let i = 0; i < plain.data.length; i++) {
      if (!crossesBlob[i]) continue;
      const ordered = strong.data[i]! < medium.data[i]! && medium.data[i]! < weak.data[i]! && weak.data[i]! < plain.data[i]!;
      if (!ordered) wrong += 1;
    }
    expect(wrong).toBe(0);
  });

  it('adds value / 255 × EXTRA_ABSORPTION_PER_MM per mm along the ray', () => {
    // Straight through the blob at pose (0°, 0°): the beam runs along y, and the blob is 4 voxels (4 mm) deep.
    const ap: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
    const projection = createProjection(ap);
    const centre = { x: phantom.origin.x + 74, y: phantom.origin.y + 51.5, z: phantom.origin.z + 62.5 };
    const p = projection.project(centre);
    const pixel = { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 };
    const without = transmissionAt(emptyVolume, projection, pixel);
    const withBlob = transmissionAt(emptyVolume, projection, pixel, { extraAbsorption: blob(128) });
    expect(without).toBe(1);
    expect(withBlob).toBeCloseTo(Math.exp(-(128 / 255) * EXTRA_ABSORPTION_PER_MM * 4), 6);
  });

  it('rejects an extra volume of the wrong length with a clear error', () => {
    const projection = createProjection(POSE);
    for (const length of [0, voxels - 1, voxels + 1]) {
      const extraAbsorption = new Uint8Array(length);
      expect(() => renderDrrCpu(phantom, POSE, { extraAbsorption }), `length ${length}`).toThrow(/extra absorption/i);
      expect(() => transmissionAt(phantom, projection, { x: 256, y: 256 }, { extraAbsorption })).toThrow(
        /extra absorption/i,
      );
    }
  });
});
