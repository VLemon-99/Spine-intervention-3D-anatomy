import { describe, expect, it } from 'vitest';
import { createHistory, HISTORY_KEY } from '../../src/app/history';
import { createSafeStorage, type StorageLike } from '../../src/app/storage';
import type { AttemptRecord } from '../../src/core/types';

// Made-up records only.
function fakeBacking(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const procedure = (date: string, totalScore: number, extra: Partial<AttemptRecord> = {}): AttemptRecord =>
  ({
    kind: 'procedure',
    mode: 'practice',
    procedureId: 'test-procedure',
    date,
    totalScore,
    scoreParts: { views: 10, accuracy: totalScore - 10 },
    unsafe: false,
    shots: 7,
    fluoroTimeSeconds: 12.5,
    ...extra,
  }) as AttemptRecord;

const quiz = (date: string, totalScore: number): AttemptRecord => ({
  kind: 'quiz',
  mode: 'quiz',
  date,
  totalScore,
  scoreParts: { correct: totalScore },
  unsafe: false,
});

describe('history', () => {
  it('added records come back newest first, both procedure and quiz records', () => {
    const backing = fakeBacking();
    const h = createHistory(createSafeStorage(() => backing));
    const a = procedure('2026-01-01T10:00:00Z', 50);
    const b = quiz('2026-01-03T10:00:00Z', 80);
    const c = procedure('2026-01-02T10:00:00Z', 60, { unsafe: true });
    expect(h.add(a)).toBe('ok');
    expect(h.add(b)).toBe('ok');
    expect(h.add(c)).toBe('ok');
    expect(h.list()).toEqual([b, c, a]);
  });

  it('records with the same date come back the one added last first', () => {
    const backing = fakeBacking();
    const h = createHistory(createSafeStorage(() => backing));
    const first = procedure('2026-01-01T10:00:00Z', 40);
    const second = quiz('2026-01-01T10:00:00Z', 90);
    h.add(first);
    h.add(second);
    expect(h.list()).toEqual([second, first]);
  });

  it('records survive a new history object made on the same storage (as after a reload)', () => {
    const backing = fakeBacking();
    const a = procedure('2026-01-01T10:00:00Z', 50);
    const b = quiz('2026-01-02T10:00:00Z', 70);
    const before = createHistory(createSafeStorage(() => backing));
    before.add(a);
    before.add(b);
    const after = createHistory(createSafeStorage(() => backing));
    expect(after.list()).toEqual([b, a]);
  });

  it('clear() empties the list', () => {
    const backing = fakeBacking();
    const h = createHistory(createSafeStorage(() => backing));
    h.add(procedure('2026-01-01T10:00:00Z', 50));
    expect(h.clear()).toBe('ok');
    expect(h.list()).toEqual([]);
  });

  it('a stored value that is not JSON gives an empty list and no error', () => {
    const backing = fakeBacking();
    backing.data.set(HISTORY_KEY, '{not json');
    const h = createHistory(createSafeStorage(() => backing));
    expect(() => h.list()).not.toThrow();
    expect(h.list()).toEqual([]);
    backing.data.set(HISTORY_KEY, '{"a":1}');
    expect(h.list()).toEqual([]);
  });

  it('a stored value with invalid entries gives a list without them and no error', () => {
    const backing = fakeBacking();
    const good = procedure('2026-01-01T10:00:00Z', 50);
    const goodQuiz = quiz('2026-01-02T10:00:00Z', 60);
    const invalid = [
      null,
      42,
      'text',
      [],
      { ...good, kind: 'other' },
      { ...good, mode: 'hacker' },
      { ...good, date: 'not a date' },
      { ...good, totalScore: '50' },
      { ...good, totalScore: 150 },
      { ...good, unsafe: 'no' },
      { ...good, scoreParts: { views: 'ten' } },
      { ...good, procedureId: 7 },
      { ...good, shots: -1 },
      { ...goodQuiz, procedureId: 'x' },
    ];
    backing.data.set(HISTORY_KEY, JSON.stringify([good, ...invalid, goodQuiz]));
    const h = createHistory(createSafeStorage(() => backing));
    expect(h.list()).toEqual([goodQuiz, good]);
  });

  it('extra unknown fields in a stored entry are not passed on', () => {
    const backing = fakeBacking();
    const good = quiz('2026-01-02T10:00:00Z', 60);
    backing.data.set(HISTORY_KEY, JSON.stringify([{ ...good, html: '<img src=x>' }]));
    expect(createHistory(createSafeStorage(() => backing)).list()).toEqual([good]);
  });

  it('an invalid record is not saved', () => {
    const backing = fakeBacking();
    const h = createHistory(createSafeStorage(() => backing));
    expect(h.add({ kind: 'quiz' } as unknown as AttemptRecord)).toBe('invalid');
    expect(h.list()).toEqual([]);
  });

  it('with a storage that throws, available() is false, add() does not throw, and list() is empty', () => {
    const fail = (): never => {
      throw new Error('SecurityError');
    };
    const h = createHistory(createSafeStorage(() => ({ getItem: fail, setItem: fail, removeItem: fail })));
    expect(h.available()).toBe(false);
    expect(() => h.add(procedure('2026-01-01T10:00:00Z', 50))).not.toThrow();
    expect(h.add(procedure('2026-01-01T10:00:00Z', 50))).toBe('unavailable');
    expect(h.list()).toEqual([]);
    expect(() => h.clear()).not.toThrow();
  });

  it('with working storage, available() is true', () => {
    const backing = fakeBacking();
    expect(createHistory(createSafeStorage(() => backing)).available()).toBe(true);
  });
});
