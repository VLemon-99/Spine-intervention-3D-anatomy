import { describe, expect, it } from 'vitest';
import { ROTATIONS, orientPixel, type Orientation } from '../../src/render/orientation';
import { imageTapPixel, type TapSettings } from '../../src/render/imageTap';

const OPEN = { left: 0, right: 0, top: 0, bottom: 0 };
const DEFAULT: TapSettings = {
  orientation: { flipHorizontal: false, flipVertical: false, rotation: 0 },
  magnification: 1,
  collimation: OPEN,
};
const withOrientation = (o: Partial<Orientation>): TapSettings => ({
  ...DEFAULT,
  orientation: { ...DEFAULT.orientation, ...o },
});

describe('imageTapPixel', () => {
  it('with default settings a canvas pixel maps to itself', () => {
    expect(imageTapPixel({ x: 300, y: 200 }, DEFAULT)).toEqual({ x: 300, y: 200 });
  });

  it('with flip left-right (300, 200) maps to (211, 200)', () => {
    expect(imageTapPixel({ x: 300, y: 200 }, withOrientation({ flipHorizontal: true }))).toEqual({ x: 211, y: 200 });
  });

  it('with magnification 2 (356, 256) maps to (306, 256)', () => {
    expect(imageTapPixel({ x: 356, y: 256 }, { ...DEFAULT, magnification: 2 })).toEqual({ x: 306, y: 256 });
  });

  it('with any rotation (and flips) the mapping is the inverse of orientPixel', () => {
    for (const rotation of ROTATIONS) {
      for (const flipHorizontal of [false, true]) {
        for (const flipVertical of [false, true]) {
          const orientation: Orientation = { flipHorizontal, flipVertical, rotation };
          for (const taken of [{ x: 300, y: 200 }, { x: 10, y: 500 }, { x: 0, y: 511 }]) {
            const shown = orientPixel(taken, orientation);
            expect(imageTapPixel(shown, withOrientation(orientation))).toEqual(taken);
          }
        }
      }
    }
  });

  it('a position inside a canvas pixel counts as that whole pixel', () => {
    expect(imageTapPixel({ x: 300.9, y: 200.2 }, DEFAULT)).toEqual({ x: 300, y: 200 });
  });

  it('a pixel covered by a shutter gives null; the open area does not', () => {
    const settings: TapSettings = { ...DEFAULT, collimation: { ...OPEN, left: 20 } };
    expect(imageTapPixel({ x: 50, y: 256 }, settings)).toBeNull();
    expect(imageTapPixel({ x: 256, y: 256 }, settings)).toEqual({ x: 256, y: 256 });
  });

  it('the shutter is checked on the image as taken: a flipped display moves the covered area', () => {
    const settings: TapSettings = {
      ...DEFAULT,
      orientation: { ...DEFAULT.orientation, flipHorizontal: true },
      collimation: { ...OPEN, left: 20 },
    };
    expect(imageTapPixel({ x: 500, y: 256 }, settings)).toBeNull();
    expect(imageTapPixel({ x: 50, y: 256 }, settings)).toEqual({ x: 461, y: 256 });
  });

  it('a position off the image gives null', () => {
    expect(imageTapPixel({ x: -1, y: 10 }, DEFAULT)).toBeNull();
    expect(imageTapPixel({ x: 10, y: 512 }, DEFAULT)).toBeNull();
  });
});
