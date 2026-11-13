// The sim zone's section in the needle panel (F6.1): a resistance bar and the
// name of the tissue at the tip. The name is hidden in Exam mode
// (owner decision 2026-11-13: shown in Practice and Free play).

import type { Mode } from '../core/types';
import type { TipTissue } from './tissue';

const STYLE_ID = 'sim-feedback-style';
const CSS = `
  .sim-feedback { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; font-size: 14px; }
  .sim-feedback-row { display: flex; align-items: center; gap: 8px; min-height: 20px; }
  .sim-feedback-label { flex: none; color: #9aa7b5; }
  .sim-resistance-bar { position: relative; flex: 1; height: 12px; border-radius: 6px;
    background: #2c3542; overflow: hidden; }
  .sim-resistance-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0;
    background: #e0a43a; }
  .sim-tip-tissue { font-weight: 600; }
`;

export interface FeedbackView {
  /** Shows the tissue at the tip (null = no needle) for the current mode. */
  show(tissue: TipTissue | null, mode: Mode): void;
}

/** Builds the sim section (data-testid sim-feedback) and appends it to `parent`. */
export function createFeedbackView(parent: HTMLElement): FeedbackView {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }

  const section = document.createElement('div');
  section.className = 'sim-feedback';
  section.dataset.testid = 'sim-feedback';

  const barRow = document.createElement('div');
  barRow.className = 'sim-feedback-row';
  const barLabel = document.createElement('span');
  barLabel.className = 'sim-feedback-label';
  barLabel.textContent = 'Resistance';
  const bar = document.createElement('div');
  bar.className = 'sim-resistance-bar';
  bar.dataset.testid = 'resistance-bar';
  bar.setAttribute('role', 'meter');
  bar.setAttribute('aria-label', 'Resistance');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '1');
  const fill = document.createElement('div');
  fill.className = 'sim-resistance-fill';
  fill.dataset.testid = 'resistance-bar-fill';
  bar.append(fill);
  barRow.append(barLabel, bar);

  const name = document.createElement('div');
  name.className = 'sim-tip-tissue';
  name.dataset.testid = 'tip-tissue';

  section.append(barRow, name);
  parent.append(section);

  return {
    show(tissue, mode) {
      if (tissue) {
        bar.dataset.value = String(tissue.resistance);
        bar.setAttribute('aria-valuenow', String(tissue.resistance));
        fill.style.width = `${tissue.resistance * 100}%`;
      } else {
        bar.dataset.value = '';
        bar.removeAttribute('aria-valuenow');
        fill.style.width = '0';
      }
      // In Exam mode the name is left out of the page entirely, not just hidden.
      const showName = tissue !== null && mode !== 'exam';
      name.textContent = showName ? tissue.name : '';
      name.hidden = !showName;
    },
  };
}
