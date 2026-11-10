import { expect, test } from '@playwright/test';
import { acceptDisclaimer } from '../../fixtures/acceptDisclaimer';

const ZONES = ['app', 'anatomy', 'render', 'carm', 'needle', 'sim', 'view3d', 'contrast', 'procedures', 'quiz'];
const PANELS = ['fluoro-panel', 'carm-panel', 'needle-panel', 'view3d-panel'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('main.ts mounts every zone exactly once', async ({ page }) => {
  for (const zone of ZONES) {
    await expect(page.getByTestId(`zone-${zone}`)).toHaveCount(1);
  }
});

test('after accepting the disclaimer, the four main panels are visible', async ({ page }) => {
  await acceptDisclaimer(page);
  for (const panel of PANELS) {
    await expect(page.getByTestId(panel)).toBeVisible();
  }
});

test('before accepting, a click or tap at the centre of each panel lands on the disclaimer', async ({ page }) => {
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  for (const panel of PANELS) {
    const hit = await page.getByTestId(panel).evaluate((element) => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return 'hidden';
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (top?.closest('[data-testid="disclaimer"]')) return 'disclaimer';
      return element.contains(top) ? 'panel' : 'other';
    });
    expect(['disclaimer', 'hidden'], `${panel} was reachable: ${hit}`).toContain(hit);
  }
});
