// Shared simulation clock (owner decision 2026-11-14): simulation time is the
// number of seconds since the last case start, or since the clock was made
// when no case has started yet (Free play). Tissue events (sim zone) and
// contrast (injection events, washout) read the same clock, so their times
// agree. Plain TypeScript, no browser code.

import { bus, type EventBus } from './store';

export interface SimClock {
  /** Seconds since the last 'caseStart' on the bus, or since the clock was made. */
  time(): number;
}

const systemSeconds = (): number => performance.now() / 1000;

/**
 * Make a clock that restarts at each 'caseStart' on `bus`. `now` gives any
 * steadily rising time in seconds (tests hand in a fake one).
 */
export function createSimClock(bus: EventBus, now: () => number = systemSeconds): SimClock {
  let start = now();
  bus.on('caseStart', () => {
    start = now();
  });
  return { time: () => now() - start };
}

/** The app's one simulation clock, on the shared bus. Unit tests make their own with createSimClock(). */
export const simClock = createSimClock(bus);
