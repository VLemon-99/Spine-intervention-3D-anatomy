// The needle panel's set-up row (F5.1): needle and pre-bend pickers. Both are
// disabled while the needle is inserted (locked); the pre-bend picker is also
// disabled for the curved-tip cannula, whose curve is built in.

import { catalogue } from './data';
import { MAX_PRE_BEND_CHOICE_DEG, PRE_BEND_STEP_DEG, type NeedleSession } from './session';

const TOUCH_SIZE = { minHeight: '44px', minWidth: '44px', fontSize: '15px' };

function option(value: string, text: string): HTMLOptionElement {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}

/** Builds the set-up row, kept in step with the session. */
export function buildPickers(session: NeedleSession): HTMLElement {
  const row = document.createElement('div');
  row.dataset.testid = 'needle-setup';
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' });

  const needleSelect = document.createElement('select');
  needleSelect.dataset.testid = 'needle-select';
  needleSelect.setAttribute('aria-label', 'Needle');
  needleSelect.title = 'Needle (locked while inserted)';
  Object.assign(needleSelect.style, TOUCH_SIZE, { flex: '1 1 160px', maxWidth: '100%' });
  needleSelect.append(...catalogue.needles.map((n) => option(n.id, n.name)));

  const preBendSelect = document.createElement('select');
  preBendSelect.dataset.testid = 'prebend-select';
  preBendSelect.setAttribute('aria-label', 'Pre-bend');
  preBendSelect.title = 'Pre-bend of the tip (locked while inserted)';
  Object.assign(preBendSelect.style, TOUCH_SIZE, { flex: '0 0 auto' });
  for (let deg = 0; deg <= MAX_PRE_BEND_CHOICE_DEG; deg += PRE_BEND_STEP_DEG) {
    preBendSelect.append(option(String(deg), `${deg}° bend`));
  }

  const isCurved = (): boolean => catalogue.needles.find((n) => n.id === session.needleId)?.tipType === 'curved';
  const update = (): void => {
    needleSelect.value = session.needleId;
    preBendSelect.value = String(session.preBend);
    needleSelect.disabled = session.locked;
    preBendSelect.disabled = session.locked || isCurved();
  };

  needleSelect.addEventListener('change', () => {
    session.chooseNeedle(needleSelect.value);
    update();
  });
  preBendSelect.addEventListener('change', () => {
    session.choosePreBend(Number(preBendSelect.value));
    update();
  });
  session.subscribe(update);
  update();

  row.append(needleSelect, preBendSelect);
  return row;
}
