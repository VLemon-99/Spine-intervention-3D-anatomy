// The display controls of the fluoro panel (docs/SPEC.md F2.3–F2.7): compact
// buttons beside the canvas that change the render settings. So far: Invert
// and the magnification buttons (1×, 1.5×, 2×).
//
// Rules for every control here (F12 owns the final layout):
// - at least 44×44 px, so it can be tapped on a tablet;
// - on/off controls are <button> elements with aria-pressed, not checkboxes
//   (the spacebar is the Shot shortcut);
// - each control follows the settings when they are changed elsewhere.
import { MAGNIFICATIONS, type RenderSettings, type SettingsStore } from './settings';

const BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  minWidth: '64px',
  minHeight: '44px',
  padding: '0 10px',
  fontSize: '14px',
  cursor: 'pointer',
  borderRadius: '6px',
  border: '1px solid #5a6676',
  touchAction: 'manipulation',
};

/** An on/off button: `isOn` reads its state from the settings, `toggle` changes them. */
function createToggle(
  settings: SettingsStore,
  testId: string,
  label: string,
  title: string,
  isOn: (s: Readonly<RenderSettings>) => boolean,
  toggle: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = testId;
  button.textContent = label;
  button.title = title;
  Object.assign(button.style, BUTTON_STYLE);
  const show = (s: Readonly<RenderSettings>): void => {
    const on = isOn(s);
    button.setAttribute('aria-pressed', String(on));
    button.style.background = on ? '#cfe3ff' : '#f2f4f7';
    button.style.color = '#10151c';
    button.style.fontWeight = on ? '700' : '400';
  };
  show(settings.get());
  settings.subscribe(show);
  button.addEventListener('click', toggle);
  return button;
}

/** Build the controls inside `parent`. */
export function createControls(parent: HTMLElement, settings: SettingsStore): HTMLElement {
  const controls = document.createElement('div');
  controls.dataset.testid = 'fluoro-controls';
  Object.assign(controls.style, {
    display: 'flex',
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: '6px',
    flex: '0 0 auto',
    minHeight: '0',
  });

  controls.append(
    createToggle(
      settings,
      'invert-toggle',
      'Invert',
      'Swap light and dark (no new image needed)',
      (s) => s.invert,
      () => settings.set({ invert: !settings.get().invert }),
    ),
  );

  // Magnification: three buttons in a row; the one in use is pressed. It takes
  // effect on the next image.
  const magnification = document.createElement('div');
  magnification.setAttribute('role', 'group');
  magnification.setAttribute('aria-label', 'Magnification');
  Object.assign(magnification.style, { display: 'flex', gap: '4px' });
  for (const m of MAGNIFICATIONS) {
    const button = createToggle(
      settings,
      `magnification-${m}x`,
      `${m}×`,
      `Magnification ${m}× (from the next image)`,
      (s) => s.magnification === m,
      () => settings.set({ magnification: m }),
    );
    Object.assign(button.style, { minWidth: '44px', padding: '0 2px' });
    magnification.append(button);
  }
  controls.append(magnification);
  parent.append(controls);
  return controls;
}
