import { expect, test, type Page } from '@playwright/test';

// F12.5: without WebGL2 the app shows a clear message instead of a blank screen.
const MESSAGE = "This browser can't run the simulator (WebGL2 needed)";
const PANELS = ['fluoro-panel', 'carm-panel', 'needle-panel', 'view3d-panel'];

/** Make every canvas refuse a WebGL2 context, as in a browser without WebGL2. */
async function stubOutWebgl2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...rest: unknown[]
    ) {
      if (contextId === 'webgl2') return null;
      return (original as (...args: unknown[]) => unknown).call(this, contextId, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test.describe('with WebGL2 stubbed out', () => {
  test('shows the exact message and none of the four main panels', async ({ page }) => {
    await stubOutWebgl2(page);
    await page.goto('/');
    const message = page.getByTestId('webgl2-missing');
    await expect(message).toBeVisible();
    await expect(message).toHaveText(MESSAGE);
    for (const panel of PANELS) {
      await expect(page.getByTestId(panel)).toHaveCount(0);
    }
    await expect(page.getByTestId('disclaimer')).toHaveCount(0);
  });

  test('logs no uncaught errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await stubOutWebgl2(page);
    await page.goto('/');
    await expect(page.getByTestId('webgl2-missing')).toBeVisible();
    // Let any late start-up work (e.g. the dev-only test hook) finish.
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});

test('without the stub, the message is not shown', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('zone-app')).toHaveCount(1);
  await expect(page.getByTestId('webgl2-missing')).toHaveCount(0);
  await expect(page.getByTestId('disclaimer')).toBeVisible();
});
