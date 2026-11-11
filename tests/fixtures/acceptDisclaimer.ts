// Shared screen-test helper: get past the training disclaimer.
// Clicks 'I understand' in the desktop set-up and taps it in the touch tablet set-up.
// The app remembers an accepted disclaimer (F12.1), so after a reload it may not
// be shown at all: then this returns straight away. Whether it is shown is
// decided while the page loads, together with mounting the app.
import { expect, test, type Page } from '@playwright/test';

export async function acceptDisclaimer(page: Page): Promise<void> {
  // The app's marker is mounted in the same step that decides on the disclaimer.
  await expect(page.getByTestId('zone-app')).toHaveCount(1);
  const button = page.getByTestId('disclaimer-accept');
  if ((await button.count()) === 0) return;
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
  await expect(page.getByTestId('disclaimer')).toBeHidden();
}
