// Withdraw fully (F5.6): removes the needle, which also unlocks the needle and
// pre-bend pickers (F5.1). Disabled while there is no needle.

import type { NeedleSession } from './session';

export function buildWithdrawAll(session: NeedleSession): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'needle-withdraw-all';
  button.textContent = 'Withdraw fully';
  button.title = 'Remove the needle';
  Object.assign(button.style, { minWidth: '44px', minHeight: '44px', fontSize: '14px', cursor: 'pointer' });
  button.addEventListener('click', () => {
    session.withdrawFully();
  });
  const update = (): void => {
    button.disabled = session.model === null;
  };
  session.subscribe(update);
  update();
  return button;
}
