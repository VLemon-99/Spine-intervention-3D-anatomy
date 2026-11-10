// Single shot (docs/SPEC.md F0.6, F3.3). Plain function, no browser code, so it
// can be unit-tested: adds 1 to the shot count, records the current pose as
// the last image pose (kind 'shot'), then emits one 'exposure' event (the renderer draws on it).
import type { EventBus, Store } from '../core/store';

export function takeShot(store: Store, bus: EventBus): void {
  const { pose, shotCount } = store.get();
  store.set({ shotCount: shotCount + 1, lastImagePose: { ...pose }, lastImageKind: 'shot' });
  bus.emit('exposure');
}
