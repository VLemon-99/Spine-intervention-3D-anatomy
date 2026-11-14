// Desktop needle keys (F5.4). The one place the needle keys are listed, so the
// help overlay can show them. Plain TypeScript, no browser code. Keys are
// matched by position (event.code), so other keyboard layouts work.
//
// Hub angles: pitch + = toward 12 o'clock, yaw + = toward 3 o'clock.

import type { ShortcutEntry } from '../core/shortcuts';

export const ADVANCE_STEP_MM = 1;
export const ADVANCE_FINE_STEP_MM = 0.2;
export const BEVEL_STEP_DEG = 15;
export const HUB_STEP_DEG = 1;

export type NeedleKeyAction =
  | { kind: 'advance'; mm: number }
  | { kind: 'withdraw'; mm: number }
  | { kind: 'bevel'; deg: number }
  | { kind: 'hub'; dPitch: number; dYaw: number };

/** The action for a key (event.code), or null if it is not a needle key. */
export function needleKeyAction(code: string, shift: boolean): NeedleKeyAction | null {
  const mm = shift ? ADVANCE_FINE_STEP_MM : ADVANCE_STEP_MM;
  switch (code) {
    case 'KeyW':
      return { kind: 'advance', mm };
    case 'KeyS':
      return { kind: 'withdraw', mm };
    case 'KeyQ':
      return { kind: 'bevel', deg: -BEVEL_STEP_DEG };
    case 'KeyE':
      return { kind: 'bevel', deg: BEVEL_STEP_DEG };
    case 'ArrowUp':
      return { kind: 'hub', dPitch: HUB_STEP_DEG, dYaw: 0 };
    case 'ArrowDown':
      return { kind: 'hub', dPitch: -HUB_STEP_DEG, dYaw: 0 };
    case 'ArrowRight':
      return { kind: 'hub', dPitch: 0, dYaw: HUB_STEP_DEG };
    case 'ArrowLeft':
      return { kind: 'hub', dPitch: 0, dYaw: -HUB_STEP_DEG };
    default:
      return null;
  }
}

/** The 'Needle' group for the help overlay. */
export function needleShortcutEntries(): ShortcutEntry[] {
  return [
    { keys: 'W / S', action: `Advance / withdraw (${ADVANCE_STEP_MM} mm per press)` },
    { keys: 'Shift + W / S', action: `Advance / withdraw ${ADVANCE_FINE_STEP_MM} mm` },
    { keys: 'Q / E', action: `Rotate the bevel ${BEVEL_STEP_DEG}° anticlockwise / clockwise` },
    { keys: '↑ / ↓', action: `Hub toward 12 / 6 o'clock (${HUB_STEP_DEG}°)` },
    { keys: '← / →', action: `Hub toward 9 / 3 o'clock (${HUB_STEP_DEG}°)` },
  ];
}
