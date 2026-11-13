// Sim (tissue feel, events, aspiration) — F6.
// mount() connects the sim runner to the app's store and bus, builds the sim
// section (resistance bar, tissue name, Aspirate) and registers the 'sim'
// debug getter.
// main.ts mounts this zone in the needle panel's slot, after the needle zone
// (decision 2026-11-13); the section goes inside the needle panel when the
// slot has one, so it shows as part of that panel.

import { registerDebugGetter } from '../core/debugRegistry';
import { createRandom, type RandomFn } from '../core/random';
import { bus, store } from '../core/store';
import { aspirate } from './aspirate';
import { createFeedbackView } from './feedback';
import { connectSim } from './runner';

/**
 * Seed for the Aspirate random numbers (owner decision 2026-11-13): a fixed
 * number in dev/test builds, so tests can predict results; the time in
 * milliseconds in the production build.
 */
const DEV_SEED = 20261113;
function newSeed(): number {
  return import.meta.env.DEV ? DEV_SEED : Date.now();
}

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-sim';
  marker.hidden = true;
  element.append(marker);

  const sim = connectSim(store, bus);

  // Made at mount (Free play sends no caseStart) and again at each caseStart.
  let seed = newSeed();
  let random: RandomFn = createRandom(seed);
  bus.on('caseStart', () => {
    seed = newSeed();
    random = createRandom(seed);
  });

  const panel = element.querySelector<HTMLElement>('[data-testid="needle-panel"]') ?? element;
  const view = createFeedbackView(panel, () => {
    const tissue = sim.tipTissue();
    return tissue ? aspirate(tissue.key, random) : null;
  });
  const refresh = (): void => view.show(sim.tipTissue(), store.get().mode);
  store.subscribe(refresh);
  refresh();

  registerDebugGetter('sim', () => {
    const tissue = sim.tipTissue();
    return {
      tipTissue: tissue ? tissue.key : null,
      resistance: tissue ? tissue.resistance : null,
      events: sim.events(),
      seed,
    };
  });
}
