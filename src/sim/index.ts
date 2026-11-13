// Sim (tissue feel, events, aspiration) — F6.
// mount() connects the sim runner to the app's store and bus and registers the
// 'sim' debug getter for screen tests. Its marker element stays hidden until
// the sim's section in the needle panel exists (F6-S9).

import { registerDebugGetter } from '../core/debugRegistry';
import { bus, store } from '../core/store';
import { connectSim } from './runner';

export function mount(element: HTMLElement): void {
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-sim';
  marker.hidden = true;
  element.append(marker);

  const sim = connectSim(store, bus);
  registerDebugGetter('sim', () => {
    const tissue = sim.tipTissue();
    return {
      tipTissue: tissue ? tissue.key : null,
      resistance: tissue ? tissue.resistance : null,
      events: sim.events(),
    };
  });
}
