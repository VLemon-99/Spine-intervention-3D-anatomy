// C-arm and table controls, exposure, counters — F3.
// mount() builds this zone's panel (carm-panel) with the Shot button and the
// spacebar shortcut (F0.6, F3.3) and the pose sliders (F3.2). Fluoro and
// counters come later in F3.
import { bus, store } from '../core/store';
import { changePose } from './limits';
import { takeShot } from './shot';
import { stepPose } from './keymap';
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

  // Title and Shot side by side, to keep the quarter-screen panel compact.
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' });
  heading.style.margin = '0';
  header.append(heading, shotButton);

  panel.append(marker, header, buildSliders(store));
  element.append(panel);

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
}
