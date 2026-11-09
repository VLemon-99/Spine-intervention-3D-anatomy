// App entry point: shows the training disclaimer. Later stories mount every
// zone's panel here (only the app zone edits this file).
import { showDisclaimer } from './disclaimer';

const root = document.getElementById('app');
if (root) {
  showDisclaimer(document.body);
}
