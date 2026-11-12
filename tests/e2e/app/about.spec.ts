import { expect, test, type Page } from '@playwright/test';
import packageJson from '../../../package.json' with { type: 'json' };

// F12.1: the About page shows the disclaimer, the app version and the dataset
// credits from the manifest. Manifests here are made up (fake names only) and
// served with page.route; nothing is added to public/data/.
const MANIFEST = '**/data/manifest.json';

const FAKE_MANIFEST = {
  regions: [
    {
      name: 'test-lumbar',
      title: 'Test lumbar',
      sourceDataset: 'Example Spine Dataset A',
      licence: 'CC BY 4.0',
      attribution: 'Example Lab A, fake attribution for tests.',
    },
    {
      name: 'test-cervical',
      title: 'Test cervical',
      sourceDataset: 'Example Spine Dataset B',
      licence: 'CC BY-SA 4.0',
      attribution: 'Example Lab B, another fake attribution.',
    },
  ],
};

/** Click on desktop, tap on the tablet. */
async function press(page: Page, testid: string): Promise<void> {
  const button = page.getByTestId(testid);
  if (test.info().project.use.hasTouch) {
    await button.tap();
  } else {
    await button.click();
  }
}

async function serveManifest(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(MANIFEST, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

async function openAbout(page: Page): Promise<void> {
  await page.goto('/');
  await press(page, 'disclaimer-accept');
  await press(page, 'home-about');
  await expect(page.getByTestId('about-screen')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-screen', 'about');
}

test('shows the disclaimer text', async ({ page }) => {
  await serveManifest(page, FAKE_MANIFEST);
  await openAbout(page);
  const disclaimer = page.getByTestId('about-disclaimer');
  await expect(disclaimer).toContainText('For training only');
  await expect(disclaimer).toContainText('not for clinical use');
});

test('the disclaimer text is the same as on the disclaimer screen', async ({ page }) => {
  await page.goto('/');
  const shown = await page.getByTestId('disclaimer').locator('p').textContent();
  await press(page, 'disclaimer-accept');
  await press(page, 'home-about');
  await expect(page.getByTestId('about-disclaimer')).toHaveText(shown ?? 'missing');
});

test('shows the version from package.json', async ({ page }) => {
  await serveManifest(page, FAKE_MANIFEST);
  await openAbout(page);
  await expect(page.getByTestId('about-version')).toContainText(packageJson.version);
});

test("with a test manifest of two regions, it shows each region's dataset name, licence and attribution", async ({
  page,
}) => {
  await serveManifest(page, FAKE_MANIFEST);
  await openAbout(page);
  const credits = page.getByTestId('about-credit');
  await expect(credits).toHaveCount(2);
  for (const [i, region] of FAKE_MANIFEST.regions.entries()) {
    await expect(credits.nth(i).getByTestId('about-credit-dataset')).toHaveText(region.sourceDataset);
    await expect(credits.nth(i).getByTestId('about-credit-licence')).toHaveText(region.licence);
    await expect(credits.nth(i).getByTestId('about-credit-attribution')).toHaveText(region.attribution);
  }
  await expect(page.getByTestId('about-no-dataset')).toHaveCount(0);
});

test('an attribution with HTML tags is shown as plain text and adds no elements', async ({ page }) => {
  const tricky = '<b>Bold</b><img src="x" data-testid="injected"><script>window.__hacked = 1</script>';
  await serveManifest(page, {
    regions: [{ sourceDataset: 'Example <i>Dataset</i>', licence: 'CC BY 4.0', attribution: tricky }],
  });
  await openAbout(page);
  const credit = page.getByTestId('about-credit');
  await expect(credit.getByTestId('about-credit-attribution')).toHaveText(tricky);
  await expect(credit.getByTestId('about-credit-dataset')).toHaveText('Example <i>Dataset</i>');
  await expect(page.getByTestId('about-credits').locator('b, i, img, script')).toHaveCount(0);
  await expect(page.getByTestId('injected')).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __hacked?: number }).__hacked)).toBeUndefined();
});

test('with no manifest (404), it shows the phantom-only text', async ({ page }) => {
  await serveManifest(page, { error: 'not found' }, 404);
  await openAbout(page);
  await expect(page.getByTestId('about-no-dataset')).toHaveText(
    'Images are computed from a synthetic test phantom; no patient data is used.',
  );
  await expect(page.getByTestId('about-credit')).toHaveCount(0);
});

test('with a manifest listing no regions, it shows the phantom-only text', async ({ page }) => {
  await serveManifest(page, { regions: [] });
  await openAbout(page);
  await expect(page.getByTestId('about-no-dataset')).toBeVisible();
  await expect(page.getByTestId('about-credit')).toHaveCount(0);
});

test('its buttons are at least 44×44 px, and the Home button returns to the home screen', async ({ page }) => {
  await serveManifest(page, FAKE_MANIFEST);
  await page.goto('/');
  await press(page, 'disclaimer-accept');
  for (const testid of ['home-about']) {
    const box = await page.getByTestId(testid).boundingBox();
    expect(box && box.width >= 44 && box.height >= 44, `${testid} size`).toBe(true);
  }
  await press(page, 'home-about');
  const buttons = page.getByTestId('about-screen').getByRole('button');
  for (const button of [...(await buttons.all()), page.getByTestId('home-button')]) {
    const box = await button.boundingBox();
    expect(box && box.width >= 44 && box.height >= 44).toBe(true);
  }
  await press(page, 'home-button');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('about-screen')).toBeHidden();
});
