// Pose sliders (docs/SPEC.md F3.2): one slider with a number readout for each
// of the five pose values. Moving a slider changes the pose in the store
// through changePose() (clamped, F3.1); the sliders also follow the store when
// the pose changes elsewhere (keys, tests). Moving a slider never takes an image.
import type { Store } from '../core/store';
import type { CArmPose } from '../core/types';
import { POSE_LIMITS, changePose } from './limits';

interface SliderSpec {
  key: keyof CArmPose;
  /** Test-id suffix: slider-<id>, readout-<id>. */
  id: string;
  label: string;
  unit: '°' | ' mm';
  /** Text at the minimum end and at the maximum end. */
  minLabel: string;
  maxLabel: string;
  /** Meaning of the end labels, for the tooltip. */
  hint: string;
}

const SLIDERS: readonly SliderSpec[] = [
  { key: 'oblique', id: 'oblique', label: 'Oblique', unit: '°', minLabel: 'L', maxLabel: 'R', hint: 'Oblique rotation: L = left, R = right' },
  { key: 'tilt', id: 'tilt', label: 'Tilt', unit: '°', minLabel: 'CAUD', maxLabel: 'CRAN', hint: 'Tilt: CAUD = caudal, CRAN = cranial' },
  {
    key: 'tableLeftRight',
    id: 'table-left-right',
    label: 'Table L/R',
    unit: ' mm',
    minLabel: 'R',
    maxLabel: 'L',
    hint: "Table left/right: toward the patient's R = right, L = left",
  },
  {
    key: 'tableHeadFoot',
    id: 'table-head-foot',
    label: 'Table H/F',
    unit: ' mm',
    minLabel: 'FOOT',
    maxLabel: 'HEAD',
    hint: 'Table head/foot: toward the FOOT or the HEAD',
  },
  { key: 'tableHeight', id: 'table-height', label: 'Height', unit: ' mm', minLabel: 'DOWN', maxLabel: 'UP', hint: 'Table height: DOWN or UP' },
];

/** Readout text: the signed number with its unit, e.g. '25°', '-10°', '15 mm'. */
export function formatReadout(value: number, unit: string): string {
  return `${Object.is(value, -0) ? 0 : value}${unit}`;
}

const STYLE = `
  .carm-sliders { display: flex; flex-direction: column; gap: 2px; }
  .carm-slider-row { display: flex; align-items: center; gap: 4px; font-size: 13px; }
  .carm-slider-row label { width: 64px; flex: none; }
  .carm-slider-end { width: 34px; flex: none; text-align: center; font-size: 11px; color: #a9b4c2; }
  .carm-slider-row input[type='range'] { flex: 1; min-width: 44px; height: 44px; margin: 0; touch-action: none; }
  .carm-readout { width: 56px; flex: none; text-align: right; font-variant-numeric: tabular-nums; }
`;

/** Build the five slider rows, wired to the store. */
export function buildSliders(store: Store): HTMLElement {
  const container = document.createElement('div');
  container.className = 'carm-sliders';
  const style = document.createElement('style');
  style.textContent = STYLE;
  container.append(style);

  const updaters: ((pose: CArmPose) => void)[] = [];

  for (const spec of SLIDERS) {
    const { min, max } = POSE_LIMITS[spec.key];
    const row = document.createElement('div');
    row.className = 'carm-slider-row';
    row.title = spec.hint;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.id = `carm-slider-${spec.id}`;
    input.dataset.testid = `slider-${spec.id}`;

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = spec.label;

    const end = (text: string, which: 'min' | 'max'): HTMLElement => {
      const el = document.createElement('span');
      el.className = 'carm-slider-end';
      el.dataset.testid = `slider-${spec.id}-${which}-label`;
      el.textContent = text;
      return el;
    };

    const readout = document.createElement('output');
    readout.className = 'carm-readout';
    readout.htmlFor.add(input.id);
    readout.dataset.testid = `readout-${spec.id}`;

    input.addEventListener('input', () => changePose(store, { [spec.key]: Number(input.value) }));

    updaters.push((pose) => {
      const value = pose[spec.key];
      if (Number(input.value) !== value) input.value = String(value);
      readout.textContent = formatReadout(value, spec.unit);
    });

    row.append(label, end(spec.minLabel, 'min'), input, end(spec.maxLabel, 'max'), readout);
    container.append(row);
  }

  const update = (pose: CArmPose): void => updaters.forEach((fn) => fn(pose));
  let lastPose: CArmPose | null = null;
  store.subscribe((state) => {
    if (state.pose === lastPose) return;
    lastPose = state.pose;
    update(state.pose);
  });
  lastPose = store.get().pose;
  update(lastPose);
  return container;
}
