// Advance and Withdraw buttons (F5.5). A press (click, tap or Enter) moves
// 1 mm straight away. Held for longer than HOLD_DELAY_MS, the needle keeps
// moving at HOLD_SPEED_MM_PER_S until release (draft numbers, owner decision
// 2026-11-13). Movement while held follows the real time passed, so a slow
// device moves the same distance per second.

import { ADVANCE_STEP_MM } from './keys';
import type { NeedleSession } from './session';

export const HOLD_DELAY_MS = 300;
export const HOLD_SPEED_MM_PER_S = 5;
const TICK_MS = 40;

function holdButton(
  testId: string,
  label: string,
  title: string,
  move: (mm: number) => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = testId;
  button.textContent = label;
  button.title = title;
  Object.assign(button.style, {
    minWidth: '44px',
    minHeight: '44px',
    fontSize: '15px',
    cursor: 'pointer',
    touchAction: 'none',
    userSelect: 'none',
  });

  let timer: number | null = null;
  let pointerId: number | null = null;

  const stop = (): void => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    pointerId = null;
  };

  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    button.setPointerCapture(event.pointerId);
    move(ADVANCE_STEP_MM);
    const pressedAt = performance.now();
    let movedUntil = pressedAt + HOLD_DELAY_MS;
    timer = window.setInterval(() => {
      const now = performance.now();
      if (now <= movedUntil) return;
      move(((now - movedUntil) / 1000) * HOLD_SPEED_MM_PER_S);
      movedUntil = now;
    }, TICK_MS);
  });
  const release = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) stop();
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  window.addEventListener('blur', stop);
  // A long press on a touch screen must not open a menu.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  // Keyboard activation (Enter / Space on the focused button) has no pointer: one step.
  button.addEventListener('click', (event) => {
    if (event.detail === 0) move(ADVANCE_STEP_MM);
  });
  return button;
}

/** The Advance and Withdraw buttons. */
export function buildAdvanceButtons(session: NeedleSession): { advance: HTMLButtonElement; withdraw: HTMLButtonElement } {
  return {
    advance: holdButton('needle-advance', 'Advance', 'Advance 1 mm (hold to keep advancing)', (mm) => {
      session.advance(mm);
    }),
    withdraw: holdButton('needle-withdraw', 'Withdraw', 'Withdraw 1 mm (hold to keep withdrawing)', (mm) => {
      session.withdraw(mm);
    }),
  };
}
