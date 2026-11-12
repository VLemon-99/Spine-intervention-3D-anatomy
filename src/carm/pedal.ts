// On-screen Fluoro pedal (docs/SPEC.md F3.4): fluoro runs while the button is
// held with the mouse or a finger, using the same runner as the F key.
// Pointer events with pointer capture, so sliding the finger off the button
// keeps fluoro running until it is lifted. touch-action: none and a blocked
// context menu stop the tablet from scrolling or opening a long-press menu.
// Stops on pointer-up, pointer-cancel and lost capture; the runner itself also
// stops when the page is hidden. Times come from the pointer events.
import type { FluoroRunner } from './fluoroRunner';

export function buildPedal(runner: FluoroRunner): HTMLButtonElement {
  const pedal = document.createElement('button');
  pedal.type = 'button';
  pedal.dataset.testid = 'fluoro-pedal';
  pedal.textContent = 'Fluoro';
  pedal.title = 'Hold for continuous fluoro (or hold F)';
  pedal.setAttribute('aria-pressed', 'false');
  Object.assign(pedal.style, {
    minWidth: '88px',
    minHeight: '44px',
    fontSize: '16px',
    cursor: 'pointer',
    touchAction: 'none',
    userSelect: 'none',
    webkitUserSelect: 'none',
  });
  pedal.style.setProperty('-webkit-touch-callout', 'none');

  let activePointer: number | null = null;

  pedal.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (activePointer !== null) return;
    event.preventDefault();
    activePointer = event.pointerId;
    try {
      pedal.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic or already-released pointer cannot be captured; holding still works.
    }
    runner.begin(event.timeStamp);
  });

  const release = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    runner.end(event.timeStamp);
  };
  pedal.addEventListener('pointerup', release);
  pedal.addEventListener('pointercancel', release);
  pedal.addEventListener('lostpointercapture', release);
  pedal.addEventListener('contextmenu', (event) => event.preventDefault());

  // Show whether fluoro is running (also when it is stopped another way, e.g. the page is hidden).
  runner.onChange((on) => {
    pedal.setAttribute('aria-pressed', String(on));
    pedal.style.background = on ? '#b8860b' : '';
    if (!on) activePointer = null;
  });
  return pedal;
}
