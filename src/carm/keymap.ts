// Keyboard shortcuts for the C-arm pose (docs/SPEC.md F3.2). The one place the
// pose keys are listed, so they are easy to change and the help overlay can
// show them. Plain TypeScript, no browser code.
//
// Planning choice (the owner may change it; the spec names no keys). The keys
// avoid those reserved for the needle (W, S, Q, E, arrow keys), Space and F.
// Keys are matched by position (event.code), so other keyboard layouts work.
import type { CArmPose } from '../core/types';
import { clampPose } from './limits';

export interface PoseKey {
  /** KeyboardEvent.code, e.g. 'KeyJ'. */
  code: string;
  /** The key as shown to the learner. */
  label: string;
  field: keyof CArmPose;
  /** +1 or −1: direction of the step in the pose value. */
  sign: 1 | -1;
  /** 'angle' steps 1° (5° with Shift); 'table' always steps 5 mm. */
  kind: 'angle' | 'table';
  /** What it does, for the help overlay. */
  action: string;
}

export const ANGLE_STEP_DEG = 1;
export const ANGLE_SHIFT_STEP_DEG = 5;
export const TABLE_STEP_MM = 5;

export const POSE_KEYS: readonly PoseKey[] = [
  { code: 'KeyJ', label: 'J', field: 'oblique', sign: -1, kind: 'angle', action: 'Oblique left' },
  { code: 'KeyL', label: 'L', field: 'oblique', sign: 1, kind: 'angle', action: 'Oblique right' },
  { code: 'KeyI', label: 'I', field: 'tilt', sign: 1, kind: 'angle', action: 'Tilt cranial' },
  { code: 'KeyK', label: 'K', field: 'tilt', sign: -1, kind: 'angle', action: 'Tilt caudal' },
  { code: 'KeyN', label: 'N', field: 'tableLeftRight', sign: -1, kind: 'table', action: "Table toward the patient's right" },
  { code: 'KeyM', label: 'M', field: 'tableLeftRight', sign: 1, kind: 'table', action: "Table toward the patient's left" },
  { code: 'KeyU', label: 'U', field: 'tableHeadFoot', sign: 1, kind: 'table', action: 'Table toward the head' },
  { code: 'KeyO', label: 'O', field: 'tableHeadFoot', sign: -1, kind: 'table', action: 'Table toward the feet' },
  { code: 'KeyY', label: 'Y', field: 'tableHeight', sign: 1, kind: 'table', action: 'Table up' },
  { code: 'KeyH', label: 'H', field: 'tableHeight', sign: -1, kind: 'table', action: 'Table down' },
];

/** Size of one step for a key: 1° or 5° (Shift) for angles, always 5 mm for the table. */
export function stepSize(key: PoseKey, shift: boolean): number {
  if (key.kind === 'table') return TABLE_STEP_MM;
  return shift ? ANGLE_SHIFT_STEP_DEG : ANGLE_STEP_DEG;
}

/** The pose after one press of the key (clamped), or null if it is not a pose key. */
export function stepPose(pose: CArmPose, code: string, shift: boolean): CArmPose | null {
  const key = POSE_KEYS.find((k) => k.code === code);
  if (!key) return null;
  return clampPose({ ...pose, [key.field]: pose[key.field] + key.sign * stepSize(key, shift) });
}
