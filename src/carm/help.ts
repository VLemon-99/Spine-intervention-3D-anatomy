// Help overlay listing every keyboard shortcut (docs/SPEC.md F3.2).
// This zone registers the 'C-arm' group in the shared shortcut list
// (src/core/shortcuts.ts); the overlay lists every registered group, so other
// zones (e.g. the needle, F5) add their keys without touching this zone.
// Opens with ? or the on-screen '?' button; closes with Escape, ? or Close.
import type { ShortcutEntry, ShortcutList } from '../core/shortcuts';
import { ANGLE_SHIFT_STEP_DEG, ANGLE_STEP_DEG, POSE_KEYS, TABLE_STEP_MM } from './keymap';

/** The C-arm group: pose keys (paired per value) plus Shift, Space, F and ?. */
export function carmShortcutEntries(): ShortcutEntry[] {
  const entries: ShortcutEntry[] = [];
  const fields = [...new Set(POSE_KEYS.map((k) => k.field))];
  for (const field of fields) {
    const keys = POSE_KEYS.filter((k) => k.field === field);
    const step = keys[0].kind === 'angle' ? `${ANGLE_STEP_DEG}° per press` : `${TABLE_STEP_MM} mm per press`;
    entries.push({ keys: keys.map((k) => k.label).join(' / '), action: `${keys.map((k) => k.action).join(' / ')} (${step})` });
  }
  entries.push(
    { keys: 'Shift + angle key', action: `Step the angle ${ANGLE_SHIFT_STEP_DEG}° instead of ${ANGLE_STEP_DEG}°` },
    { keys: 'Space', action: 'Shot (take one image)' },
    { keys: 'F (hold)', action: 'Fluoro (continuous images while held)' },
    { keys: '?', action: 'Show or hide this help' },
  );
  return entries;
}

const STYLE = `
  .carm-help { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.55); }
  .carm-help[hidden] { display: none; }
  .carm-help-box { background: #18202a; color: #e6e9ee; border: 1px solid #2c3542; border-radius: 8px;
    padding: 12px 16px; max-width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
    box-sizing: border-box; }
  .carm-help-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .carm-help-head h2 { margin: 0; font-size: 18px; }
  .carm-help h3 { margin: 12px 0 4px; font-size: 15px; }
  .carm-help table { border-collapse: collapse; font-size: 14px; }
  .carm-help td { padding: 2px 12px 2px 0; vertical-align: top; }
  .carm-help kbd { font-family: inherit; font-weight: 600; white-space: nowrap; }
  .carm-help-close, .carm-help-button { min-width: 44px; min-height: 44px; font-size: 16px; cursor: pointer; }
`;

export interface HelpOverlay {
  /** The on-screen '?' button that opens the overlay (for the panel). */
  button: HTMLButtonElement;
  /** The overlay element (add it to the page). */
  overlay: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

/** Build the overlay and its '?' button, listing every group in the shortcut list. */
export function buildHelp(list: ShortcutList): HelpOverlay {
  const overlay = document.createElement('div');
  overlay.className = 'carm-help';
  overlay.dataset.testid = 'help-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Keyboard shortcuts');
  overlay.hidden = true;

  const style = document.createElement('style');
  style.textContent = STYLE;

  const box = document.createElement('div');
  box.className = 'carm-help-box';
  const head = document.createElement('div');
  head.className = 'carm-help-head';
  const title = document.createElement('h2');
  title.textContent = 'Keyboard shortcuts';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'carm-help-close';
  closeButton.dataset.testid = 'help-close';
  closeButton.textContent = 'Close';
  head.append(title, closeButton);
  const groups = document.createElement('div');
  box.append(head, groups);
  overlay.append(style, box);

  const render = (): void => {
    groups.replaceChildren(
      ...list.list().map(({ group, entries }) => {
        const section = document.createElement('section');
        section.dataset.testid = 'help-group';
        const heading = document.createElement('h3');
        heading.textContent = group;
        const table = document.createElement('table');
        for (const entry of entries) {
          const row = table.insertRow();
          const kbd = document.createElement('kbd');
          kbd.textContent = entry.keys;
          row.insertCell().append(kbd);
          row.insertCell().textContent = entry.action;
        }
        section.append(heading, table);
        return section;
      }),
    );
  };
  render();
  list.subscribe(render);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'carm-help-button';
  button.dataset.testid = 'help-button';
  button.textContent = '?';
  button.title = 'Keyboard shortcuts (?)';
  button.setAttribute('aria-label', 'Keyboard shortcuts');

  const help: HelpOverlay = {
    button,
    overlay,
    isOpen: () => !overlay.hidden,
    open() {
      overlay.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    },
    close() {
      overlay.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    },
    toggle() {
      if (help.isOpen()) help.close();
      else help.open();
    },
  };
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => help.toggle());
  closeButton.addEventListener('click', () => help.close());
  // A click on the dimmed background (not the box) also closes it.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) help.close();
  });
  return help;
}
