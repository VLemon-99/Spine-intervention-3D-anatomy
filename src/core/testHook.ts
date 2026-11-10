// The window.__sim test hook (docs/SPEC.md F0.7, docs/ARCHITECTURE.md → Test
// hook). Loaded by src/app/main.ts only inside an import.meta.env.DEV check,
// so it is not part of the production build.
//
// __sim.getState() returns a copy of the shared state screen tests need;
// zones add more read-only getters with registerDebugGetter()
// (src/core/debugRegistry.ts), which appear as __sim.<name>(). Every value is
// a copy, so changing it never changes the app.

import { getDebugGetter } from './debugRegistry';
import type { Store } from './store';
import type { CArmPose } from './types';

export interface SimHookState {
  pose: CArmPose;
  shotCount: number;
  lastImagePose: CArmPose | null;
  /** Region name and size of the current volume, or null before loading. */
  volume: { region: string; size: { x: number; y: number; z: number } } | null;
}

export interface SimHook {
  getState(): SimHookState;
  /** Getters registered by zones. */
  [name: string]: (() => unknown) | undefined;
}

/** Install __sim on `target` (window in the app; a plain object in unit tests). */
export function installTestHook(target: object, store: Store): SimHook {
  const getState = (): SimHookState => {
    const state = store.get();
    return structuredClone({
      pose: state.pose,
      shotCount: state.shotCount,
      lastImagePose: state.lastImagePose,
      volume: state.volume ? { region: state.volume.region, size: state.volume.size } : null,
    });
  };
  const hook = new Proxy({ getState } as SimHook, {
    get(own, name) {
      if (typeof name !== 'string') return undefined;
      if (name in own) return own[name];
      const getter = getDebugGetter(name);
      return getter ? () => structuredClone(getter()) : undefined;
    },
  });
  (target as { __sim?: SimHook }).__sim = hook;
  return hook;
}
