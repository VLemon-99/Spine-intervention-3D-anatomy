// The sim runner (F6.2, F6.3): watches the store's needle, runs the tissue
// tracker against the store's volume and landmarks, and sends each new event
// on the bus as 'tissueEvent'. Plain TypeScript, no browser code.

import type { EventBus, Store } from '../core/store';
import type { NeedleState, TissueEvent } from '../core/types';
import { tipTissue, type TipTissue } from './tissue';
import { createTissueTracker } from './tracker';

/** A clock in seconds (any starting point); the runner counts from caseStart or from connecting. */
export type Clock = () => number;

const defaultClock: Clock = () => performance.now() / 1000;

export interface SimRunner {
  /** This attempt's events, oldest first (a copy). */
  events(): TissueEvent[];
  /** The tissue at the tip of the store's needle, or null with no needle or no volume. */
  tipTissue(): TipTissue | null;
  /** Seconds since the last caseStart (or since connecting). */
  time(): number;
  /** Stops watching the store and the bus. */
  disconnect(): void;
}

/**
 * Connects the sim to a store and bus. Simulation time is seconds since the
 * last caseStart, or since connecting (owner decision 2026-11-13).
 */
export function connectSim(store: Store, bus: EventBus, clock: Clock = defaultClock): SimRunner {
  const tracker = createTissueTracker();
  let events: TissueEvent[] = [];
  let startSeconds = clock();
  let lastNeedle: NeedleState | null = store.get().needle;

  const time = (): number => clock() - startSeconds;

  const onStateChange = (): void => {
    const { needle, volume, landmarks } = store.get();
    if (needle === lastNeedle) return;
    lastNeedle = needle;
    if (!needle) {
      tracker.reset();
      return;
    }
    if (!volume) return;
    const newEvents = tracker.update(needle, volume, time(), landmarks);
    for (const event of newEvents) {
      events.push(event);
      bus.emit('tissueEvent', event);
    }
  };

  const onCaseStart = (): void => {
    events = [];
    tracker.reset();
    startSeconds = clock();
  };

  const unsubscribe = store.subscribe(onStateChange);
  bus.on('caseStart', onCaseStart);

  return {
    events: () => events.map((event) => ({ ...event, tip: { ...event.tip } })),
    tipTissue() {
      const { needle, volume } = store.get();
      return needle && volume ? tipTissue(needle, volume) : null;
    },
    time,
    disconnect() {
      unsubscribe();
      bus.off('caseStart', onCaseStart);
    },
  };
}
