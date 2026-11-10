import { describe, expect, it } from 'vitest';
import { IMAGE_SIZE_PX, createProjection } from '../../src/core/geometry';
import { TISSUE } from '../../src/core/labels';
import { createPhantom } from '../../src/core/phantom';
import { initialState } from '../../src/core/store';

describe('default pose corner rays (no browser page)', () => {
  it('the rays through all four corner pixels cross only air voxels of the phantom', () => {
    const phantom = createPhantom();
    const projection = createProjection(initialState().pose);
    const { x: nx, y: ny, z: nz } = phantom.size;
    const last = IMAGE_SIZE_PX - 0.5;
    const corners = [
      { x: 0.5, y: 0.5 },
      { x: last, y: 0.5 },
      { x: 0.5, y: last },
      { x: last, y: last },
    ];
    /** Labels of the voxels a pixel's ray crosses, sampled every 0.25 mm from source to detector. */
    const labelsOnRay = (pixel: { x: number; y: number }): number[] => {
      const { origin, direction } = projection.unproject(pixel);
      const labels: number[] = [];
      for (let t = 0; t <= 1000; t += 0.25) {
        const i = Math.round((origin.x + t * direction.x - phantom.origin.x) / phantom.spacing.x);
        const j = Math.round((origin.y + t * direction.y - phantom.origin.y) / phantom.spacing.y);
        const k = Math.round((origin.z + t * direction.z - phantom.origin.z) / phantom.spacing.z);
        if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
        labels.push(phantom.labels[i + nx * (j + ny * k)] ?? TISSUE.air);
      }
      return labels;
    };
    for (const corner of corners) {
      expect(labelsOnRay(corner).every((label) => label === TISSUE.air), `corner ${JSON.stringify(corner)}`).toBe(true);
    }
    // Sanity check of the sampler: the central ray does cross non-air tissue.
    expect(labelsOnRay({ x: 256, y: 256 }).some((label) => label !== TISSUE.air)).toBe(true);
  });
});
