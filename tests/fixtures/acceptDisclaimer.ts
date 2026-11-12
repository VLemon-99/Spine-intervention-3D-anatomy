// Shared screen-test helper: get past the training disclaimer and the home screen.
// Clicks in the desktop set-up and taps in the touch tablet set-up.
// The app remembers an accepted disclaimer (F12.1), so after a reload it may not
// be shown at all: then it is skipped. Whether it is shown is decided while the
// page loads, together with mounting the app. When the home screen is then shown
// (F12.2), it chooses Free play, so the test lands on the four panels.
import { expect, test, type Page } from '@playwright/test';

export async function acceptDisclaimer(page: Page): Promise<void> {
  const press = async (testid: string): Promise<void> => {
    const button = page.getByTestId(testid);
    if (test.info().project.use.hasTouch) {
      await button.tap();
    } else {
      await button.click();
    }
  };

  // The app's marker is mounted in the same step that decides on the disclaimer.
  await expect(page.getByTestId('zone-app')).toHaveCount(1);
  if ((await page.getByTestId('disclaimer-accept').count()) > 0) {
    await press('disclaimer-accept');
    await expect(page.getByTestId('disclaimer')).toBeHidden();
  }
  if (await page.getByTestId('home-screen').isVisible()) {
    await press('home-freeplay');
    await expect(page.getByTestId('home-screen')).toBeHidden();
  }
}
