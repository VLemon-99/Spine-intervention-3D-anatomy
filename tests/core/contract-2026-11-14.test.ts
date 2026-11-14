// Shared-contract additions approved by the owner on 2026-11-14
// (docs/DECISIONS.md, F9 and F11 planning): the shared simulation clock
// (seconds since the last case start) and the image service through which
// another zone asks the renderer for an X-ray image.
import { describe, expect, it, vi } from 'vitest';
import { createImageService, imageService, type DrrImage } from '../../src/core/imageService';
import { createPhantom } from '../../src/core/phantom';
import { createSimClock, simClock } from '../../src/core/simClock';
import { createEventBus, initialState } from '../../src/core/store';

describe('simulation clock', () => {
  it('counts seconds from when it was made', () => {
    let now = 100;
    const clock = createSimClock(createEventBus(), () => now);
    expect(clock.time()).toBe(0);
    now = 103.5;
    expect(clock.time()).toBe(3.5);
  });

  it('starts again from 0 at each caseStart', () => {
    let now = 100;
    const bus = createEventBus();
    const clock = createSimClock(bus, () => now);
    now = 140;
    bus.emit('caseStart');
    expect(clock.time()).toBe(0);
    now = 142.25;
    expect(clock.time()).toBe(2.25);
  });

  it('is not restarted by another bus', () => {
    let now = 0;
    const clock = createSimClock(createEventBus(), () => now);
    now = 5;
    createEventBus().emit('caseStart');
    expect(clock.time()).toBe(5);
  });

  it("the app's shared clock gives a time that does not go backwards", () => {
    const first = simClock.time();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(simClock.time()).toBeGreaterThanOrEqual(first);
  });
});

describe('image service', () => {
  const pose = initialState().pose;
  const image = (): DrrImage => ({ width: 512, height: 512, pixels: new Uint8ClampedArray(512 * 512) });

  it('gives null while no renderer is registered', () => {
    const service = createImageService();
    expect(service.available()).toBe(false);
    expect(service.render(createPhantom(), pose)).toBeNull();
  });

  it('hands the volume, pose and options to the registered renderer and returns its image', () => {
    const service = createImageService();
    const made = image();
    const renderer = vi.fn(() => made);
    service.register(renderer);
    const volume = createPhantom();
    expect(service.available()).toBe(true);
    expect(service.render(volume, pose, { noiseSeed: 7 })).toBe(made);
    expect(renderer).toHaveBeenCalledWith(volume, pose, { noiseSeed: 7 });
  });

  it('uses the renderer registered last', () => {
    const service = createImageService();
    const first = vi.fn(() => image());
    const second = vi.fn(() => null);
    service.register(first);
    service.register(second);
    expect(service.render(createPhantom(), pose)).toBeNull();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("the app's shared service exists and starts without a renderer in unit tests", () => {
    expect(imageService.available()).toBe(false);
  });
});
