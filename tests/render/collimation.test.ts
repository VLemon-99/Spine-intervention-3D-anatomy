import { describe, expect, it } from 'vitest';
import { createProjection } from '../../src/core/geometry';
import { createPhantom } from '../../src/core/phantom';
import type { CArmPose } from '../../src/core/types';
import { renderDrrCpu, transmissionAt, type DrrCpuOptions } from '../../src/render/drrCpu';
import { NO_SIGNAL, isCollimated } from '../../src/render/pipeline';

const AP_POSE: CArmPose = { oblique: 0, tilt: 0, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 };
const OPEN = { left: 0, right: 0, top: 0, bottom: 0 };
const SHUTTERS = { left: 20, right: 10, top: 30, bottom: 0 };
const phantom = createPhantom();
const plain = renderDrrCpu(phantom, AP_POSE);

/**
 * Worked out by hand for SHUTTERS on the 512-pixel image: left 20% = 102.4 →
 * columns 0…102 covered; right 10% = 51.2 → columns 460…511 covered;
 * top 30% = 153.6 → rows 0…153 covered; bottom open.
 */
const inOpenRectangle = (x: number, y: number): boolean => x >= 103 && x <= 459 && y >= 154;

describe('NO_SIGNAL', () => {
  it('is black', () => {
    expect(NO_SIGNAL).toBe(0);
  });
});

describe('isCollimated', () => {
  it('covers the pixel columns x < left% × 512 and mirrors that for the other edges', () => {
    expect(isCollimated(102, 300, SHUTTERS)).toBe(true);
    expect(isCollimated(103, 300, SHUTTERS)).toBe(false);
    expect(isCollimated(459, 300, SHUTTERS)).toBe(false);
    expect(isCollimated(460, 300, SHUTTERS)).toBe(true);
    expect(isCollimated(300, 153, SHUTTERS)).toBe(true);
    expect(isCollimated(300, 154, SHUTTERS)).toBe(false);
    expect(isCollimated(300, 511, SHUTTERS)).toBe(false);
    expect(isCollimated(300, 511, { ...OPEN, bottom: 25 })).toBe(true);
    expect(isCollimated(300, 384, { ...OPEN, bottom: 25 })).toBe(true);
    expect(isCollimated(300, 383, { ...OPEN, bottom: 25 })).toBe(false);
  });
});

describe('collimation in the CPU reference', () => {
  it('covered pixels are exactly NO_SIGNAL and open pixels are unchanged', () => {
    const image = renderDrrCpu(phantom, AP_POSE, { collimation: SHUTTERS });
    let covered = 0;
    let open = 0;
    let wrong = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const value = image.data[x + 512 * y]!;
        if (inOpenRectangle(x, y)) {
          open += 1;
          if (value !== plain.data[x + 512 * y]) wrong += 1;
        } else {
          covered += 1;
          if (value !== NO_SIGNAL) wrong += 1;
        }
      }
    }
    expect(wrong).toBe(0);
    expect(open).toBe(357 * 358);
    expect(covered).toBe(512 * 512 - 357 * 358);
    // The open part still shows anatomy (it is not all one value).
    expect(image.data[256 + 512 * 256]).toBeGreaterThan(NO_SIGNAL);
    expect(image.data[256 + 512 * 256]).toBeLessThan(1);
  });

  it('with all four shutters at 0 the image is identical to one without the option', () => {
    expect(renderDrrCpu(phantom, AP_POSE, { collimation: OPEN }).data).toEqual(plain.data);
  });

  it('with left and right both at 50 every pixel is NO_SIGNAL', () => {
    const image = renderDrrCpu(phantom, AP_POSE, { collimation: { ...OPEN, left: 50, right: 50 } });
    expect(image.data.every((v) => v === NO_SIGNAL)).toBe(true);
    const topBottom = renderDrrCpu(phantom, AP_POSE, { collimation: { ...OPEN, top: 50, bottom: 50 } });
    expect(topBottom.data.every((v) => v === NO_SIGNAL)).toBe(true);
  });

  it('the covered area is the same at magnification 1 and 2', () => {
    const at2 = renderDrrCpu(phantom, AP_POSE, { collimation: SHUTTERS, magnification: 2 });
    const open2 = renderDrrCpu(phantom, AP_POSE, { magnification: 2 });
    let wrong = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const value = at2.data[x + 512 * y]!;
        const expected = inOpenRectangle(x, y) ? open2.data[x + 512 * y]! : NO_SIGNAL;
        if (value !== expected) wrong += 1;
      }
    }
    expect(wrong).toBe(0);
  }, 20_000); // two whole images on the CPU: 4–6 s on a 4-core cloud machine

  it('a single pixel follows the same rule (transmissionAt)', () => {
    const projection = createProjection(AP_POSE);
    const options = { collimation: SHUTTERS };
    expect(transmissionAt(phantom, projection, { x: 50.5, y: 300.5 }, options)).toBe(NO_SIGNAL);
    expect(transmissionAt(phantom, projection, { x: 256.5, y: 300.5 }, options)).toBe(
      transmissionAt(phantom, projection, { x: 256.5, y: 300.5 }),
    );
  });

  it('rejects values outside 0–50 and non-finite values with a clear error', () => {
    for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      for (const bad of [-1, 50.5, 80, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const options: DrrCpuOptions = { collimation: { ...OPEN, [edge]: bad } };
        expect(() => renderDrrCpu(phantom, AP_POSE, options), `${edge} = ${bad}`).toThrow(/collimation/i);
      }
    }
    expect(() => renderDrrCpu(phantom, AP_POSE, { collimation: { ...OPEN, left: 50 } })).not.toThrow();
  });
});
