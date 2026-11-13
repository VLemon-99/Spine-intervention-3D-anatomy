// Needle catalogue, physics and handling controls — F4, F5.
// mount() builds this zone's panel (needle-panel): the set-up row with the
// needle and pre-bend pickers (F5.1), and the desktop needle keys (F5.4). The app's needle session is linked to
// the store (store.needle) and registered as the 'needle' debug getter.

import { registerDebugGetter } from '../core/debugRegistry';
import { shortcuts } from '../core/shortcuts';
import { bus, store } from '../core/store';
import { needleKeyAction, needleShortcutEntries } from './keys';
import { buildPickers } from './pickers';
import { needleSession } from './session';
import { linkNeedleToStore } from './storeLink';

let linked = false;

/** True while the training disclaimer is on screen (set by the app zone on <html>). */
const disclaimerShown = (): boolean => document.documentElement.getAttribute('data-disclaimer') === 'shown';

/** True unless the simulator screen is on show (no data-screen attribute counts as the simulator). */
const otherScreen = (): boolean => {
  const screen = document.documentElement.getAttribute('data-screen');
  return screen !== null && screen !== 'sim';
};

/** True if the key belongs to a text field, slider or picker that has focus. */
function focusOwnsKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit'].includes(target.type);
}

/** Desktop needle keys (F5.4): act only on the simulator, with a needle, outside fields. */
function listenForKeys(): void {
  shortcuts.register('Needle', needleShortcutEntries());
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const action = needleKeyAction(event.code, event.shiftKey);
    if (!action || !needleSession.model) return;
    if (disclaimerShown() || otherScreen() || focusOwnsKeys(event.target)) return;
    event.preventDefault();
    if (action.kind === 'advance') needleSession.advance(action.mm);
    else if (action.kind === 'withdraw') needleSession.withdraw(action.mm);
    else if (action.kind === 'bevel') needleSession.rotateBevel(action.deg);
    else needleSession.nudgeHub(action.dPitch, action.dYaw);
  });
}

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
    listenForKeys();
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
