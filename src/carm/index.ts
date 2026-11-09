// C-arm and table controls, exposure, counters — F3.
// mount() builds this zone's panel (carm-panel) with the Shot button and the
// spacebar shortcut (F0.6, F3.3). Sliders, fluoro and counters come in F3.
import { bus, store } from '../core/store';
import { takeShot } from './shot';

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

  panel.append(marker, heading, shotButton);
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
}
