// App entry point. Only the app zone edits this file.
// 0. Checks the browser can use WebGL2; if not, shows only a message (F12.5).
// 1. Builds the layout and mounts every zone (each builds its own panel).
// 2. Puts the synthetic phantom and its landmarks in the store as the current
//    volume (the anatomy loader replaces this in F1).
// 3. Shows the training disclaimer over everything, unless the learner
//    accepted it before (remembered in the browser's local storage, F12.1).
// 4. In development and test runs only, installs the window.__sim test hook.
import { mount as mountAnatomy } from '../anatomy/index';
import { mount as mountCarm } from '../carm/index';
import { mount as mountContrast } from '../contrast/index';
import { createPhantom, createPhantomLandmarks } from '../core/phantom';
import { store } from '../core/store';
import { mount as mountNeedle } from '../needle/index';
import { mount as mountProcedures } from '../procedures/index';
import { mount as mountQuiz } from '../quiz/index';
import { mount as mountRender } from '../render/index';
import { mount as mountSim } from '../sim/index';
import { mount as mountView3d } from '../view3d/index';
import { showDisclaimer } from './disclaimer';
import { getLayout, mount as mountApp } from './index';
import { appStorage, storageKey } from './storage';
import { canUseWebgl2, showWebgl2Missing } from './webgl2';

const DISCLAIMER_KEY = storageKey('disclaimerAccepted', 1);

const root = document.getElementById('app');
if (root && !canUseWebgl2(() => document.createElement('canvas'))) {
  // Nothing else is mounted, not even the disclaimer: there is nothing to use.
  showWebgl2Missing(root);
} else if (root) {
  store.set({ volume: createPhantom(), landmarks: createPhantomLandmarks() });

  mountApp(root);
  const layout = getLayout();
  if (layout) {
    mountRender(layout.fluoro);
    mountCarm(layout.carm);
    mountNeedle(layout.needle);
    // The sim zone's feedback (resistance, Aspirate, event log) sits in the needle panel's slot (decision 2026-11-13).
    mountSim(layout.needle);
    // The contrast zone's Inject button sits beside the sim zone's Aspirate button (decision 2026-11-14).
    mountContrast(layout.needle);
    mountView3d(layout.view3d);
    mountQuiz(layout.quiz);
    for (const mountZone of [mountAnatomy, mountProcedures]) {
      mountZone(layout.other);
    }
  }

  // When storage is unavailable, read() gives nothing, so the disclaimer is
  // shown on every load, and the failed write is simply ignored.
  if (appStorage.read(DISCLAIMER_KEY) !== 'true') {
    showDisclaimer(document.body, () => {
      appStorage.write(DISCLAIMER_KEY, 'true');
    });
  }
}

// The bundler drops this branch (and testHook.ts) from the production build.
if (import.meta.env.DEV) {
  void import('../core/testHook').then(({ installTestHook }) => {
    installTestHook(window, store);
  });
}
