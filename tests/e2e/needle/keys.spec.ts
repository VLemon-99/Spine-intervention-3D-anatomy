// F5-S5: desktop needle keys (F5.4). Keys are desktop-only; the tablet
// equivalents are tested in F5-S7 (pad touch) and F5-S8 (buttons).
import { expect, test, type Page } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';
import { getSimState, takeImage } from '../../fixtures/simPage';
import { markEntryAtPixel, readNeedle, waitForVolume, type NeedleDebug } from './needlePage';

async function needle(page: Page): Promise<NeedleDebug> {
  const n = await readNeedle(page);
  if (!n) throw new Error('no needle');
  return n;
}

test.describe('desktop needle keys', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
    await acceptDisclaimer(page);
    await waitForVolume(page);
    await takeImage(page);
    expect(await markEntryAtPixel(page, { x: 256, y: 256 })).toBe('ok');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  });

  test('W advances 1 mm, Shift+W 0.2 mm, S withdraws 1 mm', async ({ page }) => {
    await page.keyboard.press('w');
    expect((await needle(page)).insertedDepth).toBeCloseTo(1, 6);
    await page.keyboard.press('Shift+W');
    expect((await needle(page)).insertedDepth).toBeCloseTo(1.2, 6);
    await page.keyboard.press('w');
    await page.keyboard.press('s');
    expect((await needle(page)).insertedDepth).toBeCloseTo(1.2, 6);
  });

  test('Q and E rotate the bevel −15° and +15°, kept within 0–360', async ({ page }) => {
    await page.keyboard.press('e');
    expect((await needle(page)).bevelAngle).toBeCloseTo(15, 6);
    await page.keyboard.press('q');
    await page.keyboard.press('q');
    expect((await needle(page)).bevelAngle).toBeCloseTo(345, 6);
  });

  test('each arrow key changes the matching hub angle by 1°', async ({ page }) => {
    const steps: [string, { pitch: number; yaw: number }][] = [
      ['ArrowUp', { pitch: 1, yaw: 0 }],
      ['ArrowRight', { pitch: 1, yaw: 1 }],
      ['ArrowDown', { pitch: 0, yaw: 1 }],
      ['ArrowLeft', { pitch: 0, yaw: 0 }],
      ['ArrowLeft', { pitch: 0, yaw: -1 }],
      ['ArrowDown', { pitch: -1, yaw: -1 }],
    ];
    for (const [key, want] of steps) {
      await page.keyboard.press(key);
      const { hubAngles } = await needle(page);
      expect(hubAngles.pitch, key).toBeCloseTo(want.pitch, 6);
      expect(hubAngles.yaw, key).toBeCloseTo(want.yaw, 6);
    }
  });

  test('with focus on a C-arm slider, an arrow key does not change the needle', async ({ page }) => {
    const before = await needle(page);
    await page.getByTestId('slider-oblique').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    expect(await needle(page)).toEqual(before);
  });

  test("pressing ? shows a 'Needle' group listing W / S, Q / E and the arrow keys", async ({ page }) => {
    await page.keyboard.press('?');
    const overlay = page.getByTestId('help-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('heading', { name: 'Needle', exact: true })).toBeVisible();
    for (const keys of ['W / S', 'Q / E', '↑ / ↓', '← / →']) {
      await expect(overlay.getByText(keys, { exact: true })).toBeVisible();
    }
  });
});

test.describe('needle keys without a needle', () => {
  test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only');

  test('W does nothing before an entry is marked', async ({ page }) => {
    await page.goto('/');
    await getSimState(page);
    await acceptDisclaimer(page);
    await waitForVolume(page);
    await page.keyboard.press('w');
    expect(await readNeedle(page)).toBeNull();
  });
});
