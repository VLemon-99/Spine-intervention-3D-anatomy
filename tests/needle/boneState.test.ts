import { describe, expect, it } from 'vitest';
import { createPhantom } from '../../src/core/phantom';
import { advance, createNeedle, toNeedleState, withdraw } from '../../src/needle/model';

const phantom = createPhantom();

describe('NeedleState.boneContact (F4.7, F6.3)', () => {
  it('is true against bone and false after withdrawing 1 mm', () => {
    // Over the upper block's lamina (|x| ≤ 12, y 16–24, z 5–24), straight in from the back skin.
    let m = createNeedle({
      needleId: 'quincke-22g-89',
      entryPoint: { x: 0, y: 42, z: 14 },
      direction: { x: 0, y: -1, z: 0 },
      preBend: 0,
    });
    expect(toNeedleState(m).boneContact).toBe(false);
    m = advance(m, 5, phantom).state;
    expect(toNeedleState(m).boneContact).toBe(false);
    m = advance(m, 30, phantom).state;
    const against = toNeedleState(m);
    expect(against.boneContact).toBe(true);
    expect(against.tip.y).toBeGreaterThan(24);
    m = withdraw(m, 1);
    expect(toNeedleState(m).boneContact).toBe(false);
  });
});
