// C-arm and table controls, exposure, counters — F3.
// mount() builds this zone's panel (carm-panel) with the Shot button and the
// spacebar shortcut (F0.6, F3.3), the pose sliders, pose keys and help
// overlay (F3.2), the shot / fluoro-time counters (F3.6) and continuous
// fluoro while F or the on-screen pedal is held (F3.4), and the region
// picker (F3.7).
import { registerDebugGetter } from '../core/debugRegistry';
import { shortcuts } from '../core/shortcuts';
import { bus, store } from '../core/store';
import { buildCounters, resetCountersOnCaseStart } from './counters';
import { createFluoro } from './fluoro';
import { createFluoroRunner } from './fluoroRunner';
import { buildHelp, carmShortcutEntries } from './help';
import { changePose } from './limits';
import { takeShot } from './shot';
import { stepPose } from './keymap';
import { buildPedal } from './pedal';
import { buildRegionPicker } from './regions';
import { buildSliders } from './sliders';

/** True while the training disclaimer is on screen (set by the app zone on <html>). */
const disclaimerShown = (): boolean => document.documentElement.getAttribute('data-disclaimer') === 'shown';

/** True if the key is meant for a text field rather than for a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'submit'].includes(target.type);
}

const isSpace = (event: KeyboardEvent): boolean => event.code === 'Space' || event.key === ' ';

export function mount(element: HTMLElement): void {
  const panel = document.createElement('section');
  panel.dataset.testid = 'carm-panel';
  panel.setAttribute('aria-label', 'C-arm');
  panel.className = 'panel';

  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-carm';
  marker.hidden = true;

  const heading = document.createElement('h2');
  heading.className = 'panel-title';
  heading.textContent = 'C-arm';

  const shotButton = document.createElement('button');
  shotButton.type = 'button';
  shotButton.dataset.testid = 'shot-button';
  shotButton.textContent = 'Shot';
  shotButton.title = 'Take one image (spacebar)';
  Object.assign(shotButton.style, { minWidth: '88px', minHeight: '44px', fontSize: '16px', cursor: 'pointer' });
  shotButton.addEventListener('click', () => takeShot(store, bus));

  // Title, counters and the buttons side by side, to keep the quarter-screen panel compact.
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' });
  heading.style.margin = '0';
  shortcuts.register('C-arm', carmShortcutEntries());
  const help = buildHelp(shortcuts);
  // Continuous fluoro (F3.4), run by holding F (below) or the on-screen pedal.
  const fluoro = createFluoroRunner(createFluoro(store, bus));
  const headerButtons = document.createElement('div');
  Object.assign(headerButtons.style, { display: 'flex', gap: '8px' });
  headerButtons.append(help.button, shotButton, buildPedal(fluoro));
  header.append(heading, buildCounters(store), headerButtons);

  // Region picker (F3.7) in a short row under the sliders.
  const regionRow = document.createElement('label');
  Object.assign(regionRow.style, { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '2px' });
  regionRow.append('Region', buildRegionPicker(store));

  panel.append(marker, header, buildSliders(store), regionRow, help.overlay);
  element.append(panel);

  // Counters reset when a new case starts (F3.6).
  resetCountersOnCaseStart(store, bus);
  // Read-only for screen tests: window.__sim.carm().
  registerDebugGetter('carm', () => ({ fluoroTimeSeconds: store.get().fluoroTimeSeconds, fluoroOn: fluoro.isOn() }));

  // Spacebar = one shot. Ignored while the disclaimer is shown (so space can
  // still press 'I understand') and while typing in a text field.
  // preventDefault stops page scrolling and stops a focused button from also
  // being 'clicked' by the same key (which would take a second shot).
  window.addEventListener('keydown', (event) => {
    if (!isSpace(event) || disclaimerShown() || isTyping(event.target)) return;
    event.preventDefault();
    if (!event.repeat) takeShot(store, bus);
  });
  window.addEventListener('keyup', (event) => {
    if (!isSpace(event) || disclaimerShown() || isTyping(event.target)) return;
    event.preventDefault();
  });

  // Pose keys (src/carm/keymap.ts): same rules as the spacebar. Keys with
  // Ctrl, Alt or Meta are left to the browser (e.g. Ctrl+L). Holding a key
  // repeats the step.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (disclaimerShown() || isTyping(event.target)) return;
    const next = stepPose(store.get().pose, event.code, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    changePose(store, next);
  });

  // ? = show or hide the help overlay; Escape closes it. Same rules as the
  // spacebar. Matched by the character, because ? sits on different keys
  // in different keyboard layouts.
  window.addEventListener('keydown', (event) => {
    if (disclaimerShown() || isTyping(event.target)) return;
    if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      if (!event.repeat) help.toggle();
    } else if (event.key === 'Escape' && help.isOpen()) {
      event.preventDefault();
      help.close();
    }
  });

  // Hold F = continuous fluoro. Same rules as the spacebar for starting; key
  // repeats are ignored. Times come from the events' own time stamps. It
  // stops on key-up, when the window loses focus and when the page is hidden,
  // so it never keeps running by itself.
  const isF = (event: KeyboardEvent): boolean => event.code === 'KeyF';
  window.addEventListener('keydown', (event) => {
    if (!isF(event) || event.ctrlKey || event.altKey || event.metaKey) return;
    if (disclaimerShown() || isTyping(event.target)) return;
    event.preventDefault();
    if (!event.repeat) fluoro.begin(event.timeStamp);
  });
  window.addEventListener('keyup', (event) => {
    if (isF(event)) fluoro.end(event.timeStamp);
  });
  window.addEventListener('blur', (event) => fluoro.end(event.timeStamp));
  document.addEventListener('visibilitychange', (event) => {
    if (document.visibilityState === 'hidden') fluoro.end(event.timeStamp);
  });
}
