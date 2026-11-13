// The needle panel's readouts (F5.6): inserted depth (mm, one decimal), a
// clock-face bevel indicator (notch at the hub's clock position, 12 o'clock =
// head) and the needle's angle to the current C-arm beam (whole degrees).
// Kept in step with store.needle and store.pose.

import type { Store } from '../core/store';
import { needleBeamAngleDeg } from './readouts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIAL_PX = 30;

function labelled(label: string, value: HTMLElement, unit: string): HTMLElement {
  const item = document.createElement('span');
  Object.assign(item.style, { display: 'inline-flex', alignItems: 'baseline', gap: '3px', whiteSpace: 'nowrap' });
  const name = document.createElement('span');
  name.textContent = label;
  name.style.color = '#9aa6b5';
  const u = document.createElement('span');
  u.textContent = unit;
  item.append(name, value, u);
  return item;
}

export function buildReadouts(store: Store): HTMLElement {
  const row = document.createElement('div');
  row.dataset.testid = 'needle-readouts';
  Object.assign(row.style, {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px 12px',
    fontSize: '13px',
    marginTop: '6px',
  });

  const depth = document.createElement('span');
  depth.dataset.testid = 'needle-depth';
  depth.style.fontWeight = '600';

  const beamAngle = document.createElement('span');
  beamAngle.dataset.testid = 'needle-beam-angle';
  beamAngle.style.fontWeight = '600';

  // Clock face: a ring with a notch dot at the bevel's clock position.
  const dial = document.createElementNS(SVG_NS, 'svg');
  dial.dataset.testid = 'needle-bevel';
  dial.setAttribute('width', String(DIAL_PX));
  dial.setAttribute('height', String(DIAL_PX));
  dial.setAttribute('viewBox', '-15 -15 30 30');
  dial.setAttribute('role', 'img');
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('r', '12');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#9aa6b5');
  ring.setAttribute('stroke-width', '1.5');
  const twelve = document.createElementNS(SVG_NS, 'line');
  twelve.setAttribute('x1', '0');
  twelve.setAttribute('y1', '-12');
  twelve.setAttribute('x2', '0');
  twelve.setAttribute('y2', '-9');
  twelve.setAttribute('stroke', '#9aa6b5');
  const notch = document.createElementNS(SVG_NS, 'circle');
  notch.dataset.testid = 'needle-bevel-notch';
  notch.setAttribute('r', '3');
  notch.setAttribute('fill', '#f0b94a');
  dial.append(ring, twelve, notch);
  const bevel = document.createElement('span');
  Object.assign(bevel.style, { display: 'inline-flex', alignItems: 'center', gap: '4px' });
  const bevelName = document.createElement('span');
  bevelName.textContent = 'Bevel';
  bevelName.style.color = '#9aa6b5';
  bevel.append(bevelName, dial);

  const update = (): void => {
    const { needle, pose } = store.get();
    depth.textContent = needle ? needle.insertedDepth.toFixed(1) : '—';
    const angle = needle ? needleBeamAngleDeg(needle, pose) : null;
    beamAngle.textContent = angle === null ? '—' : String(Math.round(angle));
    const bevelAngle = needle?.bevelAngle ?? 0;
    dial.dataset.angle = needle ? String(Math.round(bevelAngle * 10) / 10) : '';
    const r = (bevelAngle * Math.PI) / 180;
    // 0° = 12 o'clock (up), growing clockwise.
    notch.setAttribute('cx', (Math.sin(r) * 9).toFixed(3));
    notch.setAttribute('cy', (-Math.cos(r) * 9).toFixed(3));
    notch.style.display = needle ? '' : 'none';
    const clock = ((Math.round(bevelAngle / 30) + 11) % 12) + 1;
    dial.setAttribute('aria-label', needle ? `Bevel notch at ${clock} o'clock` : 'No needle');
  };
  store.subscribe(update);
  update();

  row.append(labelled('Depth', depth, 'mm'), bevel, labelled('To beam', beamAngle, '°'));
  return row;
}
