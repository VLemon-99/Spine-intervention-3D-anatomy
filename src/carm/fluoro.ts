// Continuous fluoro (docs/SPEC.md F3.4, F3.6). Plain TypeScript, no browser
// code: the clock is passed in (milliseconds), so it is unit-testable.
//
// While running, each frame records the current pose as the last image pose,
// marks the image as 'fluoro' and emits one 'exposure' event (the renderer
// redraws on it). Frames never change the shot count.
// Fluoro time is measured from the clock values, not by counting frames:
// each frame adds the time since the previous frame (or since start), and
// stop adds the rest, so slow frames lose no time.
import type { EventBus, Store } from '../core/store';

export interface Fluoro {
  /** Start a hold at `nowMs`. Does nothing if already running. */
  start(nowMs: number): void;
  /** Draw one frame at `nowMs`. Does nothing if not running. */
  frame(nowMs: number): void;
  /** End the hold at `nowMs`. Does nothing if not running. */
  stop(nowMs: number): void;
  isRunning(): boolean;
}

export function createFluoro(store: Store, bus: EventBus): Fluoro {
  let running = false;
  /** Clock value up to which time has already been added to the store. */
  let countedUntilMs = 0;

  const addTimeUpTo = (nowMs: number): void => {
    const elapsedMs = nowMs - countedUntilMs;
    if (elapsedMs > 0) {
      store.set({ fluoroTimeSeconds: store.get().fluoroTimeSeconds + elapsedMs / 1000 });
      countedUntilMs = nowMs;
    }
  };

  return {
    start(nowMs) {
      if (running) return;
      running = true;
      countedUntilMs = nowMs;
    },
    frame(nowMs) {
      if (!running) return;
      addTimeUpTo(nowMs);
      store.set({ lastImagePose: { ...store.get().pose }, lastImageKind: 'fluoro' });
      bus.emit('exposure');
    },
    stop(nowMs) {
      if (!running) return;
      addTimeUpTo(nowMs);
      running = false;
    },
    isRunning: () => running,
  };
}
