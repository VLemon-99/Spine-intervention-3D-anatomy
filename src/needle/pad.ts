// The needle control pad (F5.4, F5.5). Dragging changes the hub angles
// (right = yaw toward 3 o'clock, up = pitch toward 12 o'clock), measured from
// where the drag started and clamped to ±45° by the session. The scroll wheel
// over the pad advances (wheel up) or withdraws (wheel down) one step per wheel
// event, finer with Shift; it never scrolls the page.

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

  pad.addEventListener('pointerdown', (event) => {
    if (drag || !session.model) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const { pitch, yaw } = session.model.hubAngles;
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startPitch: pitch, startYaw: yaw };
    pad.setPointerCapture(event.pointerId);
  });
  pad.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    session.setHubAngles(drag.startPitch - dy * DRAG_DEG_PER_PX, drag.startYaw + dx * DRAG_DEG_PER_PX);
  });
  const end = (event: PointerEvent): void => {
    if (drag && event.pointerId === drag.pointerId) drag = null;
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
