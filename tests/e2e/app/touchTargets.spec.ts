import { expect, test, type Page } from '@playwright/test';

// F12.3: in the tablet set-up every visible app-zone button and toggle is at
// least 44×44 px. Other zones' content (inside elements marked data-slot: the
// panel slots, the quiz slot) is checked by each zone itself.
// The desktop run checks that the same screens are reachable by click.

const isTablet = (): boolean => Boolean(test.info().project.use.hasTouch);

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testid: string): Promise<void> {
  const button = page.getByTestId(testid);
  if (isTablet()) {
    await button.tap();
  } else {
    await button.click();
  }
}

type Small = { label: string; width: number; height: number };

/** Every visible app-zone button or toggle smaller than 44×44 px, plus how many were checked. */
async function smallTargets(page: Page): Promise<{ checked: number; small: Small[] }> {
  return page.evaluate(() => {
    const selector = [
      'button',
      '[role="button"]',
      '[role="switch"]',
      '[role="checkbox"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'input[type="button"]',
      'input[type="submit"]',
      'select',
      'summary',
    ].join(',');
    const small: { label: string; width: number; height: number }[] = [];
    let checked = 0;
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (element.closest('[data-slot]')) continue; // another zone's content
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden') continue; // not visible
      checked++;
      if (box.width < 44 || box.height < 44) {
        const label = element.dataset.testid ?? element.textContent?.trim() ?? element.tagName;
        small.push({ label, width: box.width, height: box.height });
      }
    }
    return { checked, small };
  });
}

async function checkScreen(page: Page, screen: string, minimum = 1): Promise<void> {
  const { checked, small } = await smallTargets(page);
  expect(checked, `${screen}: number of app-zone buttons checked`).toBeGreaterThanOrEqual(minimum);
  if (isTablet()) expect(small, `${screen}: buttons smaller than 44×44 px`).toEqual([]);
}

test('every app-zone screen is reachable, and on the tablet every button and toggle is at least 44×44 px', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('disclaimer')).toBeVisible();
  await checkScreen(page, 'disclaimer');
  await press(page, 'disclaimer-accept');

  await expect(page.getByTestId('home-screen')).toBeVisible();
  await checkScreen(page, 'home', 6);

  for (const [choice, screen] of [
    ['home-practice', 'procedure-picker'],
    ['home-exam', 'procedure-picker'],
    ['home-quiz', 'quiz-screen'],
    ['home-about', 'about-screen'],
    ['home-history', 'history-screen'],
    ['home-freeplay', 'sim-screen'],
  ] as const) {
    await press(page, choice);
    await expect(page.getByTestId(screen)).toBeVisible();
    await checkScreen(page, screen);
    await press(page, 'home-button');
    await expect(page.getByTestId('home-screen')).toBeVisible();
  }
});

test('the History screen with the clear dialog open', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const historyModule = '/src/app/history.ts';
    const { history } = (await import(/* @vite-ignore */ historyModule)) as typeof import('../../../src/app/history');
    history.add({
      kind: 'quiz',
      mode: 'quiz',
      date: '2026-01-01T09:00:00Z',
      totalScore: 50,
      scoreParts: { correct: 50 },
      unsafe: false,
    });
  });
  await press(page, 'disclaimer-accept');
  await press(page, 'home-history');
  await checkScreen(page, 'history with records', 2);
  await press(page, 'history-clear');
  await expect(page.getByTestId('history-clear-confirm')).toBeVisible();
  await checkScreen(page, 'history clear dialog', 3);
});
