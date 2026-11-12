import { describe, expect, it } from 'vitest';
import { IMAGE_SIZE_PX, createProjection } from '../../src/core/geometry';
import { PHANTOM_TEST_POINTS, createPhantom } from '../../src/core/phantom';
import type { CArmPose, Volume } from '../../src/core/types';
import { renderDrrCpu, transmissionAt, type DrrCpuOptions } from '../../src/render/drrCpu';
import { detectorPosition } from '../../src/render/pipeline';

const AP_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const CENTRE = IMAGE_SIZE_PX / 2;
const phantom = createPhantom();
const BODY = PHANTOM_TEST_POINTS.blockCentres.upper;
/** Soft tissue beside the bones, at the same height as the upper vertebra body. */
const SOFT = { x: 30, y: BODY.y, z: BODY.z };

/** Where a patient point appears in the image at magnification m. */
function imagePixel(pose: CArmPose, point: { x: number; y: number; z: number }, m: number): { x: number; y: number } {
  const p = createProjection(pose).project(point);
  return { x: CENTRE + (p.x - CENTRE) * m, y: CENTRE + (p.y - CENTRE) * m };
}

/**
 * Width in pixels of the upper vertebra body's dark band along the image row
 * through its centre: the number of pixels darker than halfway between the
 * soft-tissue value and the bone value.
 */
function bodyWidth(pose: CArmPose, magnification: number): number {
  const options = { magnification } as DrrCpuOptions;
  const projection = createProjection(pose);
  const body = imagePixel(pose, BODY, magnification);
  const soft = imagePixel(pose, SOFT, magnification);
  const boneValue = transmissionAt(phantom, projection, body, options);
  const softValue = transmissionAt(phantom, projection, soft, options);
  expect(boneValue).toBeLessThan(softValue - 0.05); // the two really differ
  const threshold = (boneValue + softValue) / 2;
  const y = Math.floor(body.y) + 0.5;
  let width = 0;
  for (let x = 0; x < IMAGE_SIZE_PX; x++) {
    if (transmissionAt(phantom, projection, { x: x + 0.5, y }, options) < threshold) width += 1;
  }
  // The band must lie inside the image, or the count would be cut off.
  expect(transmissionAt(phantom, projection, { x: 0.5, y }, options)).toBeGreaterThan(threshold);
  expect(transmissionAt(phantom, projection, { x: IMAGE_SIZE_PX - 0.5, y }, options)).toBeGreaterThan(threshold);
  return width;
}

/** An empty 21³ block of 1 mm voxels with a dense 3×3×3 mm blob in the middle, centred on `centre`. */
function blobVolume(centre: { x: number; y: number; z: number }): Volume {
  const n = 21;
  const intensity = new Uint8Array(n * n * n);
  for (let k = 9; k <= 11; k++) for (let j = 9; j <= 11; j++) for (let i = 9; i <= 11; i++) intensity[i + n * (j + n * k)] = 255;
  return {
    region: 'blob',
    size: { x: n, y: n, z: n },
    spacing: { x: 1, y: 1, z: 1 },
    origin: { x: centre.x - 10, y: centre.y - 10, z: centre.z - 10 },
    orientation: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    intensity,
    labels: new Uint8Array(n * n * n),
  };
}

describe('detectorPosition (step 1 of the pipeline)', () => {
  it('is centre + (p − centre) / m', () => {
    expect(detectorPosition({ x: 300, y: 100 }, 1)).toEqual({ x: 300, y: 100 });
    expect(detectorPosition({ x: 356, y: 56 }, 2)).toEqual({ x: 306, y: 156 });
    expect(detectorPosition({ x: 256, y: 256 }, 1.5)).toEqual({ x: 256, y: 256 });
  });
});

describe('magnification in the CPU reference', () => {
  it('scales the projected width of the upper vertebra body by 1.5 and 2 (±5%)', () => {
    const w1 = bodyWidth(AP_POSE, 1);
    const w15 = bodyWidth(AP_POSE, 1.5);
    const w2 = bodyWidth(AP_POSE, 2);
    expect(w1).toBeGreaterThan(30); // a real structure, not a few stray pixels
    expect(Math.abs(w15 / w1 - 1.5) / 1.5, `widths ${w1}, ${w15}`).toBeLessThanOrEqual(0.05);
    expect(Math.abs(w2 / w1 - 2) / 2, `widths ${w1}, ${w2}`).toBeLessThanOrEqual(0.05);
  });

  it('magnification 1 gives the same image as no option', () => {
    const projection = createProjection(AP_POSE);
    for (const pixel of [
      { x: 0.5, y: 0.5 },
      { x: 255.5, y: 200.5 },
      { x: 300.5, y: 180.5 },
    ]) {
      expect(transmissionAt(phantom, projection, pixel, { magnification: 1 })).toBe(
        transmissionAt(phantom, projection, pixel),
      );
    }
  });

  it('at 1×, lowering the table (anatomy closer to the source) makes the structure wider', () => {
    // At pose (0°, 0°) the source is under the table, so a lower table is closer to it.
    const normal = bodyWidth(AP_POSE, 1);
    const lower = bodyWidth({ ...AP_POSE, tableHeight: -100 }, 1);
    const lowest = bodyWidth({ ...AP_POSE, tableHeight: -200 }, 1);
    expect(lower).toBeGreaterThan(normal);
    expect(lowest).toBeGreaterThan(lower);
    // And raising it (further from the source) makes it narrower.
    expect(bodyWidth({ ...AP_POSE, tableHeight: 100 }, 1)).toBeLessThan(normal);
  });

  it('the isocentre still appears at the image centre at every magnification', () => {
    for (const pose of [AP_POSE, { oblique: 25, tilt: -10, tableLeftRight: 12, tableHeadFoot: -8, tableHeight: 15 }]) {
      const projection = createProjection(pose);
      const volume = blobVolume(projection.isocentre);
      const darkCounts: number[] = [];
      for (const magnification of [1, 1.5, 2] as const) {
        const image = renderDrrCpu(volume, pose, { magnification });
        let count = 0;
        let sumX = 0;
        let sumY = 0;
        for (let y = 0; y < image.height; y++) {
          for (let x = 0; x < image.width; x++) {
            if (image.data[x + image.width * y]! < 1) {
              count += 1;
              sumX += x + 0.5;
              sumY += y + 0.5;
            }
          }
        }
        expect(count).toBeGreaterThan(0);
        expect(Math.abs(sumX / count - CENTRE), `m ${magnification}: centre x ${sumX / count}`).toBeLessThan(0.5);
        expect(Math.abs(sumY / count - CENTRE), `m ${magnification}: centre y ${sumY / count}`).toBeLessThan(0.5);
        expect(image.data[255 + 512 * 255]).toBeLessThan(1);
        darkCounts.push(count);
      }
      // The blob's shadow covers more pixels at each higher magnification.
      expect(darkCounts[1]!).toBeGreaterThan(darkCounts[0]!);
      expect(darkCounts[2]!).toBeGreaterThan(darkCounts[1]!);
    }
  });

  it('rejects a magnification other than 1, 1.5 or 2 with a clear error', () => {
    const projection = createProjection(AP_POSE);
    for (const bad of [0, 1.2, 3, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const options = { magnification: bad } as DrrCpuOptions;
      expect(() => renderDrrCpu(phantom, AP_POSE, options)).toThrow(/magnification/i);
      expect(() => transmissionAt(phantom, projection, { x: 256, y: 256 }, options)).toThrow(/magnification/i);
    }
  });
});
