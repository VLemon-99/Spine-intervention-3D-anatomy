// Needle catalogue, physics and handling controls — F4, F5.
// mount() builds this zone's panel (needle-panel): the set-up row with the
// needle and pre-bend pickers (F5.1). The app's needle session is linked to
// the store (store.needle) and registered as the 'needle' debug getter.

import { registerDebugGetter } from '../core/debugRegistry';
import { bus, store } from '../core/store';
import { buildPickers } from './pickers';
import { needleSession } from './session';
import { linkNeedleToStore } from './storeLink';

let linked = false;

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'needle-panel';
  panel.setAttribute('aria-label', 'Needle');
  panel.className = 'panel';

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-needle';
  marker.hidden = true;

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = 'Needle';

  if (!linked) {
    linked = true;
    linkNeedleToStore(needleSession, store, bus);
    registerDebugGetter('needle', () => {
      const state = needleSession.toNeedleState();
      if (!state) return null;
      return {
        needleId: state.needleId,
        preBend: state.preBend,
        locked: needleSession.locked,
        entryPoint: { ...state.entryPoint },
        hubAngles: { ...state.hubAngles },
        bevelAngle: state.bevelAngle,
        insertedDepth: state.insertedDepth,
        tip: { ...state.tip },
      };
    });
  }

  panel.append(marker, heading, buildPickers(needleSession));
  element.append(panel);
}
