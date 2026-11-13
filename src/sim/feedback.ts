// The sim zone's section in the needle panel (F6.1): a resistance bar and the
// name of the tissue at the tip. The name is hidden in Exam mode
// (owner decision 2026-11-13: shown in Practice and Free play). An Aspirate
// button shows what comes back (F6.4).

import type { Mode } from '../core/types';
import type { AspirateResult } from './aspirate';
import type { TipTissue } from './tissue';

/** The aspiration result as shown to the learner. */
const RESULT_TEXT: Record<AspirateResult, string> = { CSF: 'CSF', blood: 'Blood', nothing: 'Nothing' };

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
  .sim-aspirate { min-width: 88px; min-height: 32px; padding: 4px 12px; font: inherit; border-radius: 6px;
    border: 1px solid #3d4a5c; background: #243041; color: inherit; cursor: pointer; }
  .sim-aspirate:disabled { opacity: 0.5; cursor: default; }
  @media (pointer: coarse) { .sim-aspirate { min-height: 44px; min-width: 88px; } }
  .sim-aspirate-result { font-weight: 600; }
`;

export interface FeedbackView {
  /** Shows the tissue at the tip (null = no needle) for the current mode. */
  show(tissue: TipTissue | null, mode: Mode): void;
}

/**
 * Builds the sim section (data-testid sim-feedback) and appends it to `parent`.
 * `onAspirate` is called when Aspirate is pressed and returns the result to show.
 */
export function createFeedbackView(parent: HTMLElement, onAspirate: () => AspirateResult | null): FeedbackView {
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

  const aspirateRow = document.createElement('div');
  aspirateRow.className = 'sim-feedback-row';
  const aspirateButton = document.createElement('button');
  aspirateButton.type = 'button';
  aspirateButton.className = 'sim-aspirate';
  aspirateButton.dataset.testid = 'aspirate';
  aspirateButton.textContent = 'Aspirate';
  const result = document.createElement('span');
  result.className = 'sim-aspirate-result';
  result.dataset.testid = 'aspirate-result';
  result.setAttribute('aria-live', 'polite');
  result.hidden = true;
  aspirateButton.addEventListener('click', () => {
    const outcome = onAspirate();
    result.textContent = outcome ? RESULT_TEXT[outcome] : '';
    result.hidden = outcome === null;
  });
  aspirateRow.append(aspirateButton, result);

  section.append(barRow, name, aspirateRow);
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
      aspirateButton.disabled = tissue === null;
      if (tissue === null) {
        result.textContent = '';
        result.hidden = true;
      }
    },
  };
}
