import { describe, expect, it, vi } from 'vitest';
import { createFluoro } from '../../src/carm/fluoro';
import { changePose } from '../../src/carm/limits';
import { takeShot } from '../../src/carm/shot';
import { createEventBus, createStore } from '../../src/core/store';

function setup() {
  const store = createStore();
  const bus = createEventBus();
  const exposure = vi.fn();
  bus.on('exposure', exposure);
  return { store, bus, exposure, fluoro: createFluoro(store, bus) };
}

describe('continuous fluoro (F3.4, F3.6), clock passed in (ms)', () => {
  it('start at 0, frames every 100 ms, stop at 2000 ms adds 2.0 s whatever the number of frames', () => {
    for (const stepMs of [100, 400, 700]) {
      const { store, fluoro } = setup();
      fluoro.start(0);
      for (let t = stepMs; t < 2000; t += stepMs) fluoro.frame(t);
      fluoro.stop(2000);
      expect(store.get().fluoroTimeSeconds).toBeCloseTo(2.0, 1);
      expect(Math.abs(store.get().fluoroTimeSeconds - 2.0)).toBeLessThanOrEqual(0.05);
    }
  });

  it('every frame emits one exposure event and records the pose at that moment; the shot count never changes', () => {
    const { store, bus, exposure, fluoro } = setup();
    const posesSeen: unknown[] = [];
    bus.on('exposure', () => posesSeen.push(store.get().lastImagePose));
    fluoro.start(0);
    changePose(store, { oblique: 10 });
    fluoro.frame(100);
    expect(exposure).toHaveBeenCalledTimes(1);
    expect(store.get().lastImagePose).toEqual(store.get().pose);
    expect(store.get().lastImagePose).not.toBe(store.get().pose);
    changePose(store, { tilt: -5 });
    fluoro.frame(200);
    expect(exposure).toHaveBeenCalledTimes(2);
    expect(store.get().lastImagePose).toEqual({ oblique: 10, tilt: -5, tableLeftRight: 0, tableHeadFoot: 0, tableHeight: 0 });
    expect(posesSeen[0]).toMatchObject({ oblique: 10, tilt: 0 });
    fluoro.stop(300);
    expect(store.get().shotCount).toBe(0);
  });

  it('a frame when not running emits nothing; after stop, frames emit nothing', () => {
    const { store, exposure, fluoro } = setup();
    fluoro.frame(50);
    expect(exposure).not.toHaveBeenCalled();
    expect(store.get().lastImagePose).toBeNull();
    fluoro.start(100);
    fluoro.frame(200);
    fluoro.stop(300);
    exposure.mockClear();
    const timeAfterStop = store.get().fluoroTimeSeconds;
    fluoro.frame(400);
    fluoro.frame(500);
    expect(exposure).not.toHaveBeenCalled();
    expect(store.get().fluoroTimeSeconds).toBe(timeAfterStop);
  });

  it('a second start while running, or a stop when not running, changes nothing', () => {
    const { store, exposure, fluoro } = setup();
    fluoro.stop(100);
    expect(store.get().fluoroTimeSeconds).toBe(0);
    expect(fluoro.isRunning()).toBe(false);
    fluoro.start(1000);
    fluoro.start(1500); // ignored: the hold started at 1000
    expect(fluoro.isRunning()).toBe(true);
    fluoro.stop(2000);
    expect(store.get().fluoroTimeSeconds).toBeCloseTo(1.0, 5);
    fluoro.stop(3000);
    expect(store.get().fluoroTimeSeconds).toBeCloseTo(1.0, 5);
    expect(exposure).not.toHaveBeenCalled();
  });

  it('two separate holds add up (1.0 s + 0.5 s = 1.5 s)', () => {
    const { store, fluoro } = setup();
    fluoro.start(0);
    fluoro.frame(400);
    fluoro.stop(1000);
    fluoro.start(5000);
    fluoro.stop(5500);
    expect(store.get().fluoroTimeSeconds).toBeCloseTo(1.5, 5);
  });

  it('after a start at 0 and one frame at 500 ms the fluoro time is already 0.5 s, before any stop', () => {
    const { store, fluoro } = setup();
    fluoro.start(0);
    fluoro.frame(500);
    expect(Math.abs(store.get().fluoroTimeSeconds - 0.5)).toBeLessThanOrEqual(0.05);
  });

  it("each frame sets lastImageKind to 'fluoro'; a single shot afterwards sets it back to 'shot'", () => {
    const { store, bus, fluoro } = setup();
    fluoro.start(0);
    fluoro.frame(16);
    expect(store.get().lastImageKind).toBe('fluoro');
    fluoro.frame(32);
    expect(store.get().lastImageKind).toBe('fluoro');
    fluoro.stop(40);
    takeShot(store, bus);
    expect(store.get().lastImageKind).toBe('shot');
    expect(store.get().shotCount).toBe(1);
  });

  it('a clock that goes backwards adds no negative time', () => {
    const { store, fluoro } = setup();
    fluoro.start(1000);
    fluoro.frame(900);
    fluoro.stop(800);
    expect(store.get().fluoroTimeSeconds).toBe(0);
  });
});
