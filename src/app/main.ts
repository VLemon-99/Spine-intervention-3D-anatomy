// App entry point. Only the app zone edits this file.
// 1. Builds the layout and mounts every zone (each builds its own panel).
// 2. Puts the synthetic phantom and its landmarks in the store as the current
//    volume (the anatomy loader replaces this in F1).
// 3. Shows the training disclaimer over everything.
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

const root = document.getElementById('app');
if (root) {
  store.set({ volume: createPhantom(), landmarks: createPhantomLandmarks() });

  mountApp(root);
  const layout = getLayout();
  if (layout) {
    mountRender(layout.fluoro);
    mountCarm(layout.carm);
    mountNeedle(layout.needle);
    mountView3d(layout.view3d);
    for (const mountZone of [mountAnatomy, mountSim, mountContrast, mountProcedures, mountQuiz]) {
      mountZone(layout.other);
    }
  }

  showDisclaimer(document.body);
}
