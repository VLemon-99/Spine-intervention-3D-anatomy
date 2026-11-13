// The needle control pad (F5.4, F5.5). Dragging (mouse or one finger) changes the hub angles
// (right = yaw toward 3 o'clock, up = pitch toward 12 o'clock), measured from
// where the drag started and clamped to ±45° by the session. The scroll wheel
// over the pad advances (wheel up) or withdraws (wheel down) one step per wheel
// event, finer with Shift; it never scrolls the page. A two-finger twist
// rotates the bevel by the twist angle (clockwise on screen = clockwise on the
// clock face). Once a second finger lands, the drag ends; the pad waits until
// every finger is lifted before a new drag can start.

import { ADVANCE_FINE_STEP_MM, ADVANCE_STEP_MM } from './keys';
import type { NeedleSession } from './session';

/** Hub change per pixel of drag, degrees (draft value, owner decision 2026-11-13). */
export const DRAG_DEG_PER_PX = 0.2;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startPitch: number;
  startYaw: number;
}

export function buildPad(session: NeedleSession): HTMLElement {
  const pad = document.createElement('div');
  pad.dataset.testid = 'needle-pad';
  pad.setAttribute('role', 'application');
  pad.setAttribute('aria-label', 'Needle control pad: drag to angle the hub, scroll to advance or withdraw');
  pad.title = 'Drag to angle the hub; scroll to advance / withdraw (Shift = fine)';
  pad.textContent = 'Drag to steer · scroll to advance';
  Object.assign(pad.style, {
    minHeight: '56px',
    minWidth: '88px',
    flex: '1 1 120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: '12px',
    border: '1px dashed #4a5566',
    borderRadius: '6px',
    background: '#1b232e',
    color: '#9aa6b5',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    boxSizing: 'border-box',
    padding: '4px',
  });

  let drag: Drag | null = null;
  /** Touch points on the pad, by pointer id. */
  const touches = new Map<number, { x: number; y: number }>();
  /** Twist in progress: the two pointers, the last angle between them (degrees) and nothing else. */
  let twist: { a: number; b: number; lastAngle: number } | null = null;
  /** True after a twist until every finger is lifted (no drag starts in between). */
  let waitForLift = false;

  const angleOf = (a: number, b: number): number => {
    const p = touches.get(a);
    const q = touches.get(b);
    if (!p || !q) return 0;
    // Screen y grows downward, so a growing angle is a clockwise turn on screen.
    return (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  };

  pad.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType !== 'mouse') touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!session.model) return;
    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    if (event.pointerType !== 'mouse' && touches.size === 2 && !twist) {
      const [a, b] = [...touches.keys()];
      drag = null;
      waitForLift = true;
      twist = { a, b, lastAngle: angleOf(a, b) };
      return;
    }
    if (drag || twist || waitForLift || touches.size > 1) return;
    const { pitch, yaw } = session.model.hubAngles;
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startPitch: pitch, startYaw: yaw };
  });
  pad.addEventListener('pointermove', (event) => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (twist && (event.pointerId === twist.a || event.pointerId === twist.b)) {
      event.preventDefault();
      const angle = angleOf(twist.a, twist.b);
      let delta = angle - twist.lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      twist.lastAngle = angle;
      if (delta !== 0) session.rotateBevel(delta);
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    session.setHubAngles(drag.startPitch - dy * DRAG_DEG_PER_PX, drag.startYaw + dx * DRAG_DEG_PER_PX);
  });
  const end = (event: PointerEvent): void => {
    touches.delete(event.pointerId);
    if (drag && event.pointerId === drag.pointerId) drag = null;
    if (twist && (event.pointerId === twist.a || event.pointerId === twist.b)) twist = null;
    if (touches.size === 0) waitForLift = false;
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);

  pad.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      // Chromium turns Shift + wheel into a sideways scroll, so read either axis.
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (delta === 0 || !session.model) return;
      const mm = event.shiftKey ? ADVANCE_FINE_STEP_MM : ADVANCE_STEP_MM;
      if (delta < 0) session.advance(mm);
      else session.withdraw(mm);
    },
    { passive: false },
  );

  return pad;
}
