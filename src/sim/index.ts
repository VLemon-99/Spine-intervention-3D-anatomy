// Sim (tissue feel, events, aspiration) — F6.
// mount() connects the sim runner to the app's store and bus, builds the sim
// section (resistance bar, tissue name) and registers the 'sim' debug getter.
// main.ts mounts this zone in the needle panel's slot, after the needle zone
// (decision 2026-11-13); the section goes inside the needle panel when the
// slot has one, so it shows as part of that panel.

import { registerDebugGetter } from '../core/debugRegistry';
import { bus, store } from '../core/store';
import { createFeedbackView } from './feedback';
import { connectSim } from './runner';

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-sim';
  marker.hidden = true;
  element.append(marker);

  const sim = connectSim(store, bus);
  const panel = element.querySelector<HTMLElement>('[data-testid="needle-panel"]') ?? element;
  const view = createFeedbackView(panel);
  const refresh = (): void => view.show(sim.tipTissue(), store.get().mode);
  store.subscribe(refresh);
  refresh();

  registerDebugGetter('sim', () => {
    const tissue = sim.tipTissue();
    return {
      tipTissue: tissue ? tissue.key : null,
      resistance: tissue ? tissue.resistance : null,
      events: sim.events(),
    };
  });
}
