// Runs continuous fluoro in the page (docs/SPEC.md F3.4): one frame per
// animation frame while a hold is active. The F key and the on-screen pedal
// (src/carm/pedal.ts) call begin()/end() with their events' own time stamps,
// because frames are slow on a software GPU and the handlers may run late.
import type { Fluoro } from './fluoro';

export interface FluoroRunner {
  /** Start fluoro at `timeMs` (performance.now() clock) and draw the first frame. */
  begin(timeMs: number): void;
  /** Stop fluoro at `timeMs`. Does nothing if not running. */
  end(timeMs: number): void;
  isOn(): boolean;
  /** Call listener whenever fluoro starts or stops. Returns a function that unsubscribes. */
  onChange(listener: (on: boolean) => void): () => void;
}

export function createFluoroRunner(fluoro: Fluoro): FluoroRunner {
  let frameRequest: number | null = null;
  const listeners = new Set<(on: boolean) => void>();
  const tell = (): void => {
    for (const listener of [...listeners]) listener(fluoro.isRunning());
  };

  const loop = (timeMs: number): void => {
    frameRequest = null;
    if (!fluoro.isRunning()) return;
    fluoro.frame(timeMs);
    frameRequest = requestAnimationFrame(loop);
  };

  return {
    begin(timeMs) {
      if (fluoro.isRunning()) return;
      fluoro.start(timeMs);
      fluoro.frame(timeMs); // first image straight away
      frameRequest = requestAnimationFrame(loop);
      tell();
    },
    end(timeMs) {
      if (!fluoro.isRunning()) return;
      fluoro.stop(timeMs);
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
      tell();
    },
    isOn: () => fluoro.isRunning(),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
