// Learner history (docs/SPEC.md F12.4): finished attempt records kept in the
// browser's local storage, newest first. Plain functions on top of the safe
// storage wrapper (src/app/storage.ts), which is handed in so unit tests need
// no browser page. What is read back from storage is untrusted: entries that
// are not valid attempt records are dropped, and a broken stored value gives an
// empty list instead of an error.
import type { AttemptRecord, Mode } from '../core/types';
import { appStorage, storageKey, type SafeStorage, type WriteResult } from './storage';

export const HISTORY_KEY = storageKey('history', 1);

const MODES: readonly Mode[] = ['practice', 'exam', 'quiz', 'freeplay'];

export interface History {
  /** Save one record. Invalid records are not saved ('invalid'); never throws. */
  add(record: AttemptRecord): WriteResult | 'invalid';
  /** All saved records, newest first (by date, then the one added last first). */
  list(): AttemptRecord[];
  /** Remove every saved record. */
  clear(): WriteResult;
  /** False when browser storage is blocked, so history cannot be saved. */
  available(): boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Check that `value` is a valid attempt record, and return a clean copy with
 * only the known fields — or null if it is not valid.
 */
export function toAttemptRecord(value: unknown): AttemptRecord | null {
  if (!isObject(value)) return null;
  const { kind, mode, date, totalScore, scoreParts, unsafe } = value;
  if (typeof mode !== 'string' || !MODES.includes(mode as Mode)) return null;
  if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) return null;
  if (typeof totalScore !== 'number' || !Number.isFinite(totalScore) || totalScore < 0 || totalScore > 100) return null;
  if (typeof unsafe !== 'boolean') return null;
  if (!isObject(scoreParts)) return null;
  const parts: Record<string, number> = {};
  for (const [name, points] of Object.entries(scoreParts)) {
    if (typeof points !== 'number' || !Number.isFinite(points)) return null;
    parts[name] = points;
  }
  const base = { mode: mode as Mode, date, totalScore, scoreParts: parts, unsafe };

  if (kind === 'quiz') {
    if ('procedureId' in value || 'shots' in value || 'fluoroTimeSeconds' in value) return null;
    return { kind: 'quiz', ...base };
  }
  if (kind === 'procedure') {
    const { procedureId, shots, fluoroTimeSeconds } = value;
    if (typeof procedureId !== 'string' || procedureId === '') return null;
    if (shots !== undefined && !isCount(shots)) return null;
    if (fluoroTimeSeconds !== undefined && !isCount(fluoroTimeSeconds)) return null;
    return {
      kind: 'procedure',
      ...base,
      procedureId,
      ...(shots !== undefined ? { shots } : {}),
      ...(fluoroTimeSeconds !== undefined ? { fluoroTimeSeconds } : {}),
    };
  }
  return null;
}

/** A history kept in `storage` (saved in the order added). */
export function createHistory(storage: SafeStorage): History {
  const readAll = (): AttemptRecord[] => {
    const text = storage.read(HISTORY_KEY);
    if (text === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toAttemptRecord).filter((record): record is AttemptRecord => record !== null);
  };

  return {
    add(record) {
      const clean = toAttemptRecord(record);
      if (!clean) return 'invalid';
      return storage.write(HISTORY_KEY, JSON.stringify([...readAll(), clean]));
    },
    list() {
      return readAll()
        .map((record, order) => ({ record, order, time: Date.parse(record.date) }))
        .sort((a, b) => b.time - a.time || b.order - a.order)
        .map(({ record }) => record);
    },
    clear: () => storage.remove(HISTORY_KEY),
    available: () => storage.available(),
  };
}

/** The app's one history (the History screen and the screen tests use this instance). */
export const history: History = createHistory(appStorage);
