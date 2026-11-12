// Shared-contract additions approved by the owner on 2026-11-11
// (docs/DECISIONS.md): the procedures on offer, the procedure request and the
// finished-attempt event that hands attempt records to the app shell.
import { describe, expect, it, vi } from 'vitest';
import { createEventBus, createStore } from '../../src/core/store';
import type { AttemptRecord, ProcedureEntry } from '../../src/core/types';

describe('store: procedures on offer', () => {
  it('starts with an empty procedure list', () => {
    expect(createStore().get().procedures).toEqual([]);
  });

  it('holds the procedures on offer and tells subscribers', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const procedures: ProcedureEntry[] = [{ id: 'phantom-demo', title: 'Phantom demo' }];
    store.set({ procedures });
    expect(store.get().procedures).toEqual(procedures);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('bus: procedureRequest and attemptFinished', () => {
  it('delivers the requested procedure id to every listener, and none after off()', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('procedureRequest', a);
    bus.on('procedureRequest', b);
    bus.emit('procedureRequest', 'phantom-demo');
    bus.off('procedureRequest', a);
    bus.emit('procedureRequest', 'si-joint');
    expect(a.mock.calls).toEqual([['phantom-demo']]);
    expect(b.mock.calls).toEqual([['phantom-demo'], ['si-joint']]);
    // @ts-expect-error the payload is a procedure id (text)
    bus.emit('procedureRequest', 3);
  });

  it('delivers finished procedure and quiz attempt records', () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on('attemptFinished', listener);
    const procedure: AttemptRecord = {
      kind: 'procedure',
      procedureId: 'phantom-demo',
      mode: 'practice',
      date: '2026-11-11T10:00:00.000Z',
      totalScore: 80,
      scoreParts: { views: 20, accuracy: 30 },
      unsafe: false,
      shots: 6,
      fluoroTimeSeconds: 4.5,
    };
    const quiz: AttemptRecord = {
      kind: 'quiz',
      mode: 'quiz',
      date: '2026-11-11T10:05:00.000Z',
      totalScore: 70,
      scoreParts: { correct: 7 },
      unsafe: false,
    };
    bus.emit('attemptFinished', procedure);
    bus.emit('attemptFinished', quiz);
    expect(listener.mock.calls).toEqual([[procedure], [quiz]]);
    // @ts-expect-error the payload must be an attempt record
    bus.emit('attemptFinished');
  });
});
