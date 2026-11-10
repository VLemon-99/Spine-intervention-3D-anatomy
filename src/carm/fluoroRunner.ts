// Runs continuous fluoro in the page (docs/SPEC.md F3.4): one frame per
// animation frame while a hold is active. The F key (and later the on-screen
// pedal) call begin()/end() with their events' own time stamps, because frames
// are slow on a software GPU and the handlers may run late.
import type { Fluoro } from './fluoro';

export interface FluoroRunner {
  /** Start fluoro at `timeMs` (performance.now() clock) and draw the first frame. */
  begin(timeMs: number): void;
  /** Stop fluoro at `timeMs`. Does nothing if not running. */
  end(timeMs: number): void;
  isOn(): boolean;
}

export function createFluoroRunner(fluoro: Fluoro): FluoroRunner {
  let frameRequest: number | null = null;

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
    },
    end(timeMs) {
      if (!fluoro.isRunning()) return;
      fluoro.stop(timeMs);
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
    },
    isOn: () => fluoro.isRunning(),
  };
}
