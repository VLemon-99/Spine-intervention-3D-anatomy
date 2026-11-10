// Shared list of keyboard shortcuts for the help overlay (F3.2, F5.4).
// Each zone registers its own keys under a group name; the help overlay (carm
// zone) lists every group, so no zone has to import another zone.
// Plain TypeScript, no browser code. Owner decision 2026-11-10.

export interface ShortcutEntry {
  /** The key or keys as shown to the learner, e.g. 'J / L' or 'Shift + key'. */
  keys: string;
  /** What it does, e.g. 'Oblique left / right (1°)'. */
  action: string;
}

export interface ShortcutGroup {
  /** Heading in the help overlay, e.g. 'C-arm' or 'Needle'. */
  group: string;
  entries: ShortcutEntry[];
}

export interface ShortcutList {
  /** Add a group, or replace its entries if it is already there (it keeps its place). */
  register(group: string, entries: readonly ShortcutEntry[]): void;
  /** Every group in the order first registered. Returns copies. */
  list(): ShortcutGroup[];
  /** Call listener after every register(). Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

export function createShortcutList(): ShortcutList {
  const groups = new Map<string, ShortcutEntry[]>();
  const listeners = new Set<() => void>();
  return {
    register(group, entries) {
      groups.set(
        group,
        entries.map((entry) => ({ ...entry })),
      );
      for (const listener of [...listeners]) listener();
    },
    list: () =>
      [...groups].map(([group, entries]) => ({ group, entries: entries.map((entry) => ({ ...entry })) })),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's shared shortcut list. Unit tests create their own with createShortcutList(). */
export const shortcuts = createShortcutList();
