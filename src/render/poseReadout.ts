// The pose text lying over the top-left of the fluoro image (docs/SPEC.md
// F2.9). A normal page element above the canvas — it is not flipped, rotated
// or inverted with the picture. It shows the pose the image ON SCREEN was
// taken with (the store's lastImagePose), so it changes only when a new image
// is taken, and it is empty before the first image.
import type { Store } from '../core/store';
import { formatPose } from './formatPose';

/** Distance of the text from the canvas's top-left corner, px. */
const INSET_PX = 6;

/**
 * Create the label inside `area` (the element that holds the canvas) and keep
 * it on the canvas's top-left corner when the layout changes.
 */
export function createPoseReadout(area: HTMLElement, canvas: HTMLCanvasElement, store: Store): HTMLElement {
  area.style.position = 'relative';
  const label = document.createElement('div');
  label.dataset.testid = 'pose-readout';
  label.setAttribute('aria-label', 'Pose of the image on screen');
  Object.assign(label.style, {
    position: 'absolute',
    // Taps and clicks go through to the image underneath (F5 will use them).
    pointerEvents: 'none',
    padding: '1px 5px',
    borderRadius: '3px',
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    fontSize: '12px',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  });
  area.append(label);

  const show = (): void => {
    const pose = store.get().lastImagePose;
    const text = pose ? formatPose(pose) : '';
    if (label.textContent !== text) label.textContent = text;
    // An empty label shows nothing at all (no dark dot on the blank screen).
    label.style.visibility = text ? 'visible' : 'hidden';
  };
  show();
  store.subscribe(show);

  // The canvas is centred in its area and changes size with the panel.
  const place = (): void => {
    label.style.left = `${canvas.offsetLeft + INSET_PX}px`;
    label.style.top = `${canvas.offsetTop + INSET_PX}px`;
  };
  place();
  const observer = new ResizeObserver(place);
  observer.observe(area);
  observer.observe(canvas);
  return label;
}
