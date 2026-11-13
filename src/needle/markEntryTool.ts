// The Mark entry tool (F5.2, F5.3). While it is on and no needle is
// inserted, an 'imageTap' bus event (the pixel of the image as taken) marks
// the entry there through the session's markEntryAtPixel; the tool then
// switches off. It is disabled before the first image and while the needle is
// inserted (and switches off when it becomes disabled).

import type { EventBus, ImageTap, Store } from '../core/store';
import type { NeedleSession } from './session';

export function buildMarkEntryTool(session: NeedleSession, store: Store, bus: EventBus): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'mark-entry';
  button.textContent = 'Mark entry';
  button.title = 'Mark the skin entry: switch on, then tap the fluoro image';
  Object.assign(button.style, { minWidth: '44px', minHeight: '44px', fontSize: '14px', cursor: 'pointer' });

  let active = false;
  const usable = (): boolean => store.get().lastImagePose !== null && !session.locked;
  const update = (): void => {
    if (!usable()) active = false;
    button.disabled = !usable();
    button.setAttribute('aria-pressed', String(active));
    button.style.outline = active ? '2px solid #f0b94a' : '';
  };

  button.addEventListener('click', () => {
    if (!usable()) return;
    active = !active;
    update();
  });
  bus.on('imageTap', (tap: ImageTap) => {
    if (!active || !usable()) return;
    session.markEntryAtPixel({ x: tap.x, y: tap.y });
    active = false;
    update();
  });
  session.subscribe(update);
  store.subscribe(update);
  update();
  return button;
}
