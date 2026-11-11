// A small safe wrapper around the browser's local storage (F12.1, F12.4).
// It never throws: when storage is blocked (private mode, browser settings) or
// full, reads give nothing and writes report 'unavailable', and the app keeps
// working. Plain TypeScript — the storage is handed in, so unit tests can pass
// a fake one.

/** The part of the browser's Storage this wrapper uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type WriteResult = 'ok' | 'unavailable';

export interface SafeStorage {
  /** The stored text, or null when there is none or storage is unavailable. */
  read(key: string): string | null;
  write(key: string, value: string): WriteResult;
  remove(key: string): WriteResult;
  /** False when storage cannot be written (blocked, missing or full). */
  available(): boolean;
}

const APP_NAME = 'spineFluoroTrainer';
const PROBE_KEY = `${APP_NAME}.probe`;

/** A storage key carrying the app name and a version, e.g. 'spineFluoroTrainer.disclaimerAccepted.v1'. */
export function storageKey(name: string, version: number): string {
  return `${APP_NAME}.${name}.v${version}`;
}

/**
 * Wrap a storage. `getBacking` is called on every use, because even reaching
 * window.localStorage can throw when the browser blocks it.
 */
export function createSafeStorage(getBacking: () => StorageLike | null | undefined): SafeStorage {
  const attempt = <T>(use: (backing: StorageLike) => T, fallback: T): T => {
    try {
      const backing = getBacking();
      if (!backing) return fallback;
      return use(backing);
    } catch {
      return fallback;
    }
  };

  return {
    read: (key) =>
      attempt((backing) => {
        const value = backing.getItem(key);
        return typeof value === 'string' ? value : null;
      }, null),
    write: (key, value) =>
      attempt<WriteResult>((backing) => {
        backing.setItem(key, value);
        return 'ok';
      }, 'unavailable'),
    remove: (key) =>
      attempt<WriteResult>((backing) => {
        backing.removeItem(key);
        return 'ok';
      }, 'unavailable'),
    available: () =>
      attempt((backing) => {
        backing.setItem(PROBE_KEY, '1');
        backing.removeItem(PROBE_KEY);
        return true;
      }, false),
  };
}

/** The app's storage: the browser's local storage, wrapped. */
export const appStorage: SafeStorage = createSafeStorage(() =>
  typeof window === 'undefined' ? null : window.localStorage,
);
