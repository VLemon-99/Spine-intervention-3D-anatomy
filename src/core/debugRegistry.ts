// Registration of read-only debug getters for screen tests
// (docs/ARCHITECTURE.md → Test hook). Zones import this file safely: in the
// production build registerDebugGetter() returns straight away, and this file
// never names the test hook object itself.

export type DebugGetter = () => unknown;

const getters = new Map<string, DebugGetter>();

/** Register a read-only getter under `name`. Does nothing in production. */
export function registerDebugGetter(name: string, getter: DebugGetter): void {
  if (!import.meta.env.DEV) return;
  getters.set(name, getter);
}

/** The getter registered under `name`, if any. */
export function getDebugGetter(name: string): DebugGetter | undefined {
  return getters.get(name);
}
