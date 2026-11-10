// Shot count and fluoro time (docs/SPEC.md F3.6, F3.3): shown in the C-arm
// panel, read from the store, and set back to zero when a new case starts.
import type { EventBus, Store } from '../core/store';

/** Set the shot count and the fluoro time back to zero. Nothing else changes. */
export function resetCounters(store: Store): void {
  store.set({ shotCount: 0, fluoroTimeSeconds: 0 });
}

/** Reset the counters on every 'caseStart' event. Returns a function that stops listening. */
export function resetCountersOnCaseStart(store: Store, bus: EventBus): () => void {
  const listener = (): void => resetCounters(store);
  bus.on('caseStart', listener);
  return () => bus.off('caseStart', listener);
}

/** Fluoro time as shown: seconds with one decimal, e.g. '0.0 s'. */
export function formatFluoroTime(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}

/** Build the two counters, kept in step with the store. */
export function buildCounters(store: Store): HTMLElement {
  const container = document.createElement('div');
  // Stacked, so the header row has room for the title and four buttons.
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '13px',
    lineHeight: '1.3',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  });

  const counter = (label: string, testId: string): HTMLElement => {
    const wrap = document.createElement('span');
    const name = document.createElement('span');
    name.textContent = `${label} `;
    name.style.color = '#a9b4c2';
    const value = document.createElement('output');
    value.dataset.testid = testId;
    wrap.append(name, value);
    container.append(wrap);
    return value;
  };
  const shots = counter('Shots', 'shot-count');
  const fluoro = counter('Fluoro', 'fluoro-time');

  const update = (): void => {
    const { shotCount, fluoroTimeSeconds } = store.get();
    shots.textContent = String(shotCount);
    fluoro.textContent = formatFluoroTime(fluoroTimeSeconds);
  };
  store.subscribe(update);
  update();
  return container;
}
