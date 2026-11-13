// Shared-contract additions approved by the owner on 2026-11-13
// (docs/DECISIONS.md, F5–F7 planning): the needle's bone-contact flag and the
// imageTap bus event (a tap on the fluoro image, as a pixel of the image as taken).
import { describe, expect, it, vi } from 'vitest';
import { createEventBus, type ImageTap } from '../../src/core/store';
import type { NeedleState } from '../../src/core/types';

const needle = (extra: Partial<NeedleState> = {}): NeedleState => ({
  needleId: 'quincke-22g-89',
  preBend: 0,
  entryPoint: { x: 0, y: 42, z: 0 },
  hubAngles: { pitch: 0, yaw: 0 },
  bevelAngle: 0,
  insertedDepth: 0,
  shaft: [{ x: 0, y: 131, z: 0 }, { x: 0, y: 42, z: 0 }],
  tip: { x: 0, y: 42, z: 0 },
  ...extra,
});

describe('NeedleState: bone contact', () => {
  it('may leave the flag out (counts as false) or set it', () => {
    expect(needle().boneContact).toBeUndefined();
    expect(needle({ boneContact: true }).boneContact).toBe(true);
    // @ts-expect-error the flag is true or false
    needle({ boneContact: 'yes' });
  });
});

describe('bus: imageTap', () => {
  it('delivers the tapped image pixel to every listener, and none after off()', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('imageTap', a);
    bus.on('imageTap', b);
    const tap: ImageTap = { x: 256, y: 256 };
    bus.emit('imageTap', tap);
    bus.off('imageTap', a);
    bus.emit('imageTap', { x: 10.5, y: 20 });
    expect(a.mock.calls).toEqual([[tap]]);
    expect(b.mock.calls).toEqual([[tap], [{ x: 10.5, y: 20 }]]);
    // @ts-expect-error the payload is a pixel
    bus.emit('imageTap');
  });
});
