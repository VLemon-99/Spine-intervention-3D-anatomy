import { describe, expect, it } from 'vitest';
import { createSafeStorage, storageKey, type StorageLike } from '../../src/app/storage';

/** A fake browser storage kept in a Map (unit tests have no browser page). */
function fakeStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/** A storage whose every call throws, as when the browser blocks it. */
function throwingStorage(): StorageLike {
  const fail = (): never => {
    throw new Error('SecurityError: storage is blocked');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

describe('storageKey', () => {
  it('carries the app name and a version', () => {
    expect(storageKey('disclaimerAccepted', 1)).toBe('spineFluoroTrainer.disclaimerAccepted.v1');
  });
});

describe('safe storage wrapper', () => {
  it('reads back what it wrote', () => {
    const backing = fakeStorage();
    const storage = createSafeStorage(() => backing);
    expect(storage.write('k', 'hello')).toBe('ok');
    expect(storage.read('k')).toBe('hello');
    expect(storage.available()).toBe(true);
  });

  it('gives nothing for a key never written, and nothing after remove', () => {
    const backing = fakeStorage();
    const storage = createSafeStorage(() => backing);
    expect(storage.read('missing')).toBeNull();
    storage.write('k', 'v');
    expect(storage.remove('k')).toBe('ok');
    expect(storage.read('k')).toBeNull();
  });

  it('with a storage whose every call throws: reads give nothing, writes report unavailable, nothing throws', () => {
    const storage = createSafeStorage(() => throwingStorage());
    expect(() => storage.read('k')).not.toThrow();
    expect(storage.read('k')).toBeNull();
    expect(storage.write('k', 'v')).toBe('unavailable');
    expect(storage.remove('k')).toBe('unavailable');
    expect(storage.available()).toBe(false);
  });

  it('when even reaching the storage throws (or there is none), it reports unavailable', () => {
    const blocked = createSafeStorage(() => {
      throw new Error('SecurityError');
    });
    expect(blocked.read('k')).toBeNull();
    expect(blocked.write('k', 'v')).toBe('unavailable');
    expect(blocked.available()).toBe(false);

    const missing = createSafeStorage(() => null);
    expect(missing.read('k')).toBeNull();
    expect(missing.write('k', 'v')).toBe('unavailable');
    expect(missing.available()).toBe(false);
  });

  it('a full storage (setItem throws) reports unavailable on write but still reads', () => {
    const backing = fakeStorage();
    backing.setItem('k', 'old');
    const full: StorageLike = {
      ...backing,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const storage = createSafeStorage(() => full);
    expect(storage.write('k', 'new')).toBe('unavailable');
    expect(storage.read('k')).toBe('old');
  });
});
