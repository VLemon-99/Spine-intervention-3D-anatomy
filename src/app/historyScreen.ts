// History screen (docs/SPEC.md F12.4): the learner's finished attempts, newest
// first, with 'Clear history' behind an in-page confirmation (not
// window.confirm, so it works the same with touch). When browser storage is
// unavailable it says so and the rest of the app keeps working.
import type { AttemptRecord } from '../core/types';
import type { History } from './history';

export const HISTORY_UNAVAILABLE_TEXT = "History can't be saved in this browser";

const MODE_LABELS: Record<AttemptRecord['mode'], string> = {
  practice: 'Practice',
  exam: 'Exam',
  quiz: 'Quiz',
  freeplay: 'Free play',
};

/** One line of text per part of an entry (plain function, so it can be unit-tested). */
export function describeAttempt(record: AttemptRecord): string[] {
  const date = new Date(record.date);
  const parts = [
    Number.isNaN(date.getTime()) ? record.date : date.toLocaleString(),
    MODE_LABELS[record.mode],
    record.kind === 'procedure' ? record.procedureId : 'Quiz',
    `Score ${record.totalScore}`,
  ];
  if (record.kind === 'procedure') {
    if (record.shots !== undefined) parts.push(`${record.shots} shots`);
    if (record.fluoroTimeSeconds !== undefined) parts.push(`Fluoro ${record.fluoroTimeSeconds.toFixed(1)} s`);
  }
  return parts;
}

export interface HistoryScreen {
  element: HTMLElement;
  /** Read the history again and show it. */
  refresh(): void;
}

function makeButton(testid: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'app-button';
  button.dataset.testid = testid;
  button.textContent = label;
  return button;
}

/** Build the History screen (test id history-screen) on top of `history`. */
export function createHistoryScreen(history: History): HistoryScreen {
  const element = document.createElement('div');
  element.className = 'app-page';
  element.dataset.testid = 'history-screen';

  const title = document.createElement('h2');
  title.className = 'app-page-title';
  title.textContent = 'History';

  const unavailable = document.createElement('p');
  unavailable.dataset.testid = 'history-unavailable';
  unavailable.setAttribute('role', 'status');
  unavailable.textContent = HISTORY_UNAVAILABLE_TEXT;

  const empty = document.createElement('p');
  empty.dataset.testid = 'history-empty';
  empty.textContent = 'No finished attempts yet.';

  const list = document.createElement('ol');
  list.className = 'app-history-list';

  const clearButton = makeButton('history-clear', 'Clear history');

  // In-page confirmation dialog.
  const dialog = document.createElement('div');
  dialog.className = 'app-dialog';
  dialog.dataset.testid = 'history-clear-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Clear history');
  const dialogCard = document.createElement('div');
  dialogCard.className = 'app-dialog-card';
  const question = document.createElement('p');
  question.textContent = 'Delete every saved attempt? This cannot be undone.';
  const confirmButton = makeButton('history-clear-confirm', 'Clear');
  const cancelButton = makeButton('history-clear-cancel', 'Cancel');
  const dialogButtons = document.createElement('div');
  dialogButtons.className = 'app-dialog-buttons';
  dialogButtons.append(cancelButton, confirmButton);
  dialogCard.append(question, dialogButtons);
  dialog.append(dialogCard);
  dialog.hidden = true;

  element.append(title, unavailable, empty, list, clearButton, dialog);

  const refresh = (): void => {
    dialog.hidden = true;
    unavailable.hidden = history.available();
    const records = history.list();
    empty.hidden = records.length > 0;
    clearButton.hidden = records.length === 0;
    list.replaceChildren(
      ...records.map((record) => {
        const item = document.createElement('li');
        item.dataset.testid = 'history-entry';
        for (const part of describeAttempt(record)) {
          const span = document.createElement('span');
          span.textContent = part;
          item.append(span);
        }
        if (record.unsafe) {
          const mark = document.createElement('strong');
          mark.dataset.testid = 'history-unsafe';
          mark.textContent = 'Unsafe';
          item.append(mark);
        }
        return item;
      }),
    );
  };

  clearButton.addEventListener('click', () => {
    dialog.hidden = false;
    cancelButton.focus();
  });
  cancelButton.addEventListener('click', () => {
    dialog.hidden = true;
    clearButton.focus();
  });
  confirmButton.addEventListener('click', () => {
    history.clear();
    refresh();
  });

  refresh();
  return { element, refresh };
}
