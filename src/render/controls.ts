// The display controls of the fluoro panel (docs/SPEC.md F2.3–F2.7): compact
// buttons beside the canvas that change the render settings. So far: Invert
// Rotate, the magnification buttons (1×, 1.5×, 2×), Flip ↔ and Flip ↕, and the
// four collimation sliders (in a fold-out group, closed at first, to save space).
//
// Rules for every control here (F12 owns the final layout):
// - at least 44×44 px, so it can be tapped on a tablet;
// - on/off controls are <button> elements with aria-pressed, not checkboxes
//   (the spacebar is the Shot shortcut);
// - a slider's touch area is the box of its <input> element, also 44×44 px;
// - each control follows the settings when they are changed elsewhere.
import {
  COLLIMATION_MAX_PERCENT,
  MAGNIFICATIONS,
  ROTATIONS,
  type Collimation,
  type RenderSettings,
  type SettingsStore,
} from './settings';

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

const SHUTTERS: readonly { edge: keyof Collimation; letter: string; name: string }[] = [
  { edge: 'left', letter: 'L', name: 'Left shutter' },
  { edge: 'right', letter: 'R', name: 'Right shutter' },
  { edge: 'top', letter: 'T', name: 'Top shutter' },
  { edge: 'bottom', letter: 'B', name: 'Bottom shutter' },
];

/** One shutter: a short label with the % readout above a 0–50 slider. */
function createShutterSlider(settings: SettingsStore, edge: keyof Collimation, letter: string, name: string): HTMLElement {
  const cell = document.createElement('label');
  Object.assign(cell.style, { display: 'flex', flexDirection: 'column', minWidth: '0', fontSize: '12px', lineHeight: '14px' });

  const caption = document.createElement('span');
  const readout = document.createElement('span');
  readout.dataset.testid = `collimation-${edge}-readout`;
  caption.append(`${letter} `, readout);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(COLLIMATION_MAX_PERCENT);
  slider.step = '1';
  slider.dataset.testid = `collimation-${edge}`;
  slider.setAttribute('aria-label', `${name} (% of the image, from the next image)`);
  slider.title = `${name}: % of the image covered (from the next image)`;
  // The <input> box is the touch area: at least 44×44 px.
  Object.assign(slider.style, { width: '100%', minWidth: '44px', height: '44px', margin: '0', cursor: 'pointer' });

  const show = (s: Readonly<RenderSettings>): void => {
    const percent = s.collimation[edge];
    slider.value = String(percent);
    readout.textContent = `${percent}%`;
  };
  show(settings.get());
  settings.subscribe(show);
  slider.addEventListener('input', () => {
    settings.set({ collimation: { [edge]: Number(slider.value) } });
  });

  cell.append(caption, slider);
  return cell;
}

/** The Collimation button and the fold-out group of four sliders it opens. */
function createCollimationGroup(settings: SettingsStore): HTMLElement[] {
  const group = document.createElement('div');
  group.id = 'collimation-group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Collimation shutters');
  Object.assign(group.style, { display: 'none', gridTemplateColumns: '1fr 1fr', gap: '4px 6px' });
  for (const { edge, letter, name } of SHUTTERS) group.append(createShutterSlider(settings, edge, letter, name));

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.dataset.testid = 'collimation-toggle';
  toggle.textContent = 'Collimation';
  toggle.title = 'Show or hide the four shutter sliders';
  toggle.setAttribute('aria-controls', group.id);
  Object.assign(toggle.style, BUTTON_STYLE, { background: '#f2f4f7', color: '#10151c' });
  let open = false;
  const show = (): void => {
    toggle.setAttribute('aria-expanded', String(open));
    group.style.display = open ? 'grid' : 'none';
  };
  show();
  toggle.addEventListener('click', () => {
    open = !open;
    show();
  });
  return [toggle, group];
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
    gap: '4px',
    flex: '0 0 auto',
    width: '140px',
    minHeight: '0',
  });

  /** A row of buttons that share the column's width equally. */
  const row = (label: string, ...buttons: HTMLElement[]): HTMLElement => {
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    Object.assign(group.style, { display: 'flex', gap: '4px' });
    for (const button of buttons) Object.assign(button.style, { flex: '1 1 0', minWidth: '44px', padding: '0 2px' });
    group.append(...buttons);
    return group;
  };

  const invert = createToggle(
    settings,
    'invert-toggle',
    'Invert',
    'Swap light and dark (no new image needed)',
    (s) => s.invert,
    () => settings.set({ invert: !settings.get().invert }),
  );

  // Rotate: each press turns the picture 90° clockwise (270° wraps to 0°); it shows the angle.
  const rotate = document.createElement('button');
  rotate.type = 'button';
  rotate.dataset.testid = 'rotate-button';
  rotate.title = 'Turn the picture 90° clockwise (no new image needed)';
  Object.assign(rotate.style, BUTTON_STYLE, { background: '#f2f4f7', color: '#10151c', lineHeight: '16px' });
  const rotateAngle = document.createElement('span');
  rotateAngle.style.display = 'block';
  rotate.append('Rotate', rotateAngle);
  const showAngle = (s: Readonly<RenderSettings>): void => {
    rotateAngle.textContent = `${s.rotation}°`;
  };
  showAngle(settings.get());
  settings.subscribe(showAngle);
  rotate.addEventListener('click', () => {
    const next = ROTATIONS[(ROTATIONS.indexOf(settings.get().rotation) + 1) % ROTATIONS.length];
    settings.set({ rotation: next });
  });

  const flips = row(
    'Flip the picture',
    createToggle(
      settings,
      'flip-horizontal',
      'Flip ↔',
      'Mirror the picture left-right (no new image needed)',
      (s) => s.flipHorizontal,
      () => settings.set({ flipHorizontal: !settings.get().flipHorizontal }),
    ),
    createToggle(
      settings,
      'flip-vertical',
      'Flip ↕',
      'Mirror the picture up-down (no new image needed)',
      (s) => s.flipVertical,
      () => settings.set({ flipVertical: !settings.get().flipVertical }),
    ),
  );

  controls.append(row('Invert and rotate', invert, rotate));

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
  controls.append(magnification, flips, ...createCollimationGroup(settings));
  parent.append(controls);
  return controls;
}
