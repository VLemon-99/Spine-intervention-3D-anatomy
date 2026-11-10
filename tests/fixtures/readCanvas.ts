// Shared screen-test helper: read grey values (0–255) from the fluoro canvas
// (test id fluoro-canvas) at (x, y) positions in its 512×512 image.
// x = column from the left, y = row from the TOP, matching src/core/geometry.ts
// (a pixel position such as 255.7 is read from pixel floor(255.7)).
// The grey value is the mean of the red, green and blue channels.
import type { Page } from '@playwright/test';

export interface PixelPosition {
  x: number;
  y: number;
}

export async function readCanvas(page: Page, positions: readonly PixelPosition[]): Promise<number[]> {
  return page.getByTestId('fluoro-canvas').evaluate((element, points) => {
    const canvas = element as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d');
    if (!context) throw new Error('no 2D context for reading pixels');
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    return points.map(({ x, y }) => {
      const column = Math.min(copy.width - 1, Math.max(0, Math.floor(x)));
      const row = Math.min(copy.height - 1, Math.max(0, Math.floor(y)));
      const i = (row * copy.width + column) * 4;
      return Math.round(((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3);
    });
  }, positions);
}
