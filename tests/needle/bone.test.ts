import { describe, expect, it } from 'vitest';
import { createPhantom, PHANTOM_TEST_POINTS } from '../../src/core/phantom';
import { TISSUE, isBone } from '../../src/core/labels';
import type { Vec3, Volume } from '../../src/core/types';
import { labelAt } from '../../src/needle/sample';
import { advance, createNeedle, toNeedleState, withdraw, type NeedleModel } from '../../src/needle/model';

const phantom = createPhantom();
const TOWARD_FRONT: Vec3 = { x: 0, y: -1, z: 0 };
const NEEDLE = 'quincke-22g-89';
/** The upper block's lamina back surface: bone voxels reach y = 24, so the nearest-voxel boundary is y = 24.5. */
const LAMINA_SURFACE_Y = 24.5;

function needleAt(entry: Vec3): NeedleModel {
  return createNeedle({ needleId: NEEDLE, entryPoint: entry, direction: TOWARD_FRONT, preBend: 0 });
}

describe('labelAt', () => {
  it('returns the phantom\'s documented labels at test points', () => {
    expect(isBone(labelAt(phantom, PHANTOM_TEST_POINTS.blockCentres.upper))).toBe(true);
    expect(isBone(labelAt(phantom, PHANTOM_TEST_POINTS.blockCentres.lower))).toBe(true);
    expect(labelAt(phantom, { x: 0, y: 44, z: 0 })).toBe(TISSUE.air); // behind the back, inside the grid
    expect(labelAt(phantom, { x: 0, y: 30, z: 0 })).toBe(TISSUE.muscle);
    expect(labelAt(phantom, { x: 0, y: 19, z: 0 })).toBe(TISSUE.ligamentumFlavum);
    expect(labelAt(phantom, { x: 0, y: 6, z: 0 })).toBe(TISSUE.spinalCord);
    expect(labelAt(phantom, { x: 0.4, y: 6.4, z: -0.4 })).toBe(TISSUE.spinalCord); // nearest voxel
  });

  it('counts points outside the grid as air', () => {
    expect(labelAt(phantom, { x: 0, y: 0, z: 60 })).toBe(TISSUE.air);
    expect(labelAt(phantom, { x: -200, y: 0, z: 0 })).toBe(TISSUE.air);
    expect(labelAt(phantom, { x: 0, y: 47.6, z: 0 })).toBe(TISSUE.air);
  });

  it('rejects a volume that is not in the standard layout', () => {
    const turned: Volume = {
      ...phantom,
      orientation: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
    };
    expect(() => labelAt(turned, { x: 0, y: 0, z: 0 })).toThrow(/orientation|layout/i);
  });
});

describe('bone stops the tip (F4.7, phantom)', () => {
  const entry: Vec3 = { x: 0, y: 42, z: 14 };

  it('advancing 40 mm toward the lamina stops outside bone within 1 mm of the surface and reports boneContact', () => {
    const result = advance(needleAt(entry), 40, phantom);
    const tip = toNeedleState(result.state).tip;
    expect(result.boneContact).toBe(true);
    expect(isBone(labelAt(phantom, tip))).toBe(false);
    expect(tip.y).toBeGreaterThanOrEqual(LAMINA_SURFACE_Y);
    expect(tip.y - LAMINA_SURFACE_Y).toBeLessThan(1);
  });

  it('advancing another 5 mm leaves the tip where it was and still reports boneContact', () => {
    const first = advance(needleAt(entry), 40, phantom);
    const second = advance(first.state, 5, phantom);
    const a = toNeedleState(first.state).tip;
    const b = toNeedleState(second.state).tip;
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.01);
    expect(second.boneContact).toBe(true);
    expect(second.state.boneContact).toBe(true);
  });

  it('withdrawing 3 mm clears the contact; advancing again stops at the same surface', () => {
    const stopped = advance(needleAt(entry), 40, phantom);
    const back = withdraw(stopped.state, 3);
    expect(back.boneContact).toBe(false);
    const nudge = advance(back, 1, phantom);
    expect(nudge.boneContact).toBe(false);
    const again = advance(nudge.state, 10, phantom);
    expect(again.boneContact).toBe(true);
    const a = toNeedleState(stopped.state).tip;
    const b = toNeedleState(again.state).tip;
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.5);
    expect(b.y - LAMINA_SURFACE_Y).toBeLessThan(1);
    expect(b.y).toBeGreaterThanOrEqual(LAMINA_SURFACE_Y);
  });

  it('advancing 25 mm along the midline between the laminae reports no bone contact', () => {
    const result = advance(needleAt({ x: 0, y: 42, z: 0 }), 25, phantom);
    const state = toNeedleState(result.state);
    expect(result.boneContact).toBe(false);
    expect(state.insertedDepth).toBeCloseTo(25, 6);
    expect(isBone(labelAt(phantom, state.tip))).toBe(false);
  });
});
