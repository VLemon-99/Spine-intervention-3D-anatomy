// Shared screen-test helper: get past the training disclaimer.
// Clicks 'I understand' in the desktop set-up and taps it in the touch tablet set-up.
import { expect, test, type Page } from '@playwright/test';

export async function acceptDisclaimer(page: Page): Promise<void> {
  const button = page.getByTestId('disclaimer-accept');
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
  await expect(page.getByTestId('disclaimer')).toBeHidden();
}
