// Links a needle session to the store and bus (F5-S3). Plain TypeScript, no browser code.
// - Every change to the session is written to store.needle (null when there is no needle).
// - The session advances through store.volume and marks pixels at store.lastImagePose.
// - On caseStart, and when a different volume is loaded, the needle is removed
//   (owner decision 2026-11-13).

import type { EventBus, Store } from '../core/store';
import type { NeedleSession } from './session';

/** Keeps `session` and `store` in step. Returns a function that undoes the link. */
export function linkNeedleToStore(session: NeedleSession, store: Store, bus: EventBus): () => void {
  const publish = (): void => store.set({ needle: session.toNeedleState() });
  session.volume = store.get().volume;
  session.lastImagePose = store.get().lastImagePose;

  const offSession = session.subscribe(publish);
  const offStore = store.subscribe((state) => {
    session.lastImagePose = state.lastImagePose;
    if (state.volume === session.volume) return;
    session.volume = state.volume;
    session.withdrawFully();
  });
  const onCaseStart = (): void => {
    session.withdrawFully();
  };
  bus.on('caseStart', onCaseStart);
  publish();

  return () => {
    offSession();
    offStore();
    bus.off('caseStart', onCaseStart);
  };
}
