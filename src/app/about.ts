// About page (docs/SPEC.md F12.1): the disclaimer, the app version and the
// dataset credits from the anatomy manifest. The manifest belongs to the
// anatomy zone; this page reads data/manifest.json itself (never imports from
// src/anatomy/) and treats it as untrusted: only text fields are used, and
// they are put on the page as text, never as HTML.
import { version } from '../../package.json';
import { DISCLAIMER_TEXT } from './disclaimer';

export const APP_VERSION: string = version;

export const PHANTOM_ONLY_TEXT = 'Images are computed from a synthetic test phantom; no patient data is used.';

/** One region's dataset credit. */
export interface DatasetCredit {
  sourceDataset: string;
  licence: string;
  attribution: string;
}

/**
 * The credits in a manifest (regions[].sourceDataset, .licence, .attribution,
 * as F1 writes them). Regions whose fields are not all text are left out;
 * anything that is not a manifest gives an empty list.
 */
export function parseCredits(manifest: unknown): DatasetCredit[] {
  if (typeof manifest !== 'object' || manifest === null) return [];
  const regions = (manifest as { regions?: unknown }).regions;
  if (!Array.isArray(regions)) return [];
  const credits: DatasetCredit[] = [];
  for (const region of regions) {
    if (typeof region !== 'object' || region === null) continue;
    const { sourceDataset, licence, attribution } = region as Record<string, unknown>;
    if (typeof sourceDataset !== 'string' || typeof licence !== 'string' || typeof attribution !== 'string') continue;
    credits.push({ sourceDataset, licence, attribution });
  }
  return credits;
}

/** Read the manifest's credits; an empty list when it is missing or invalid. Never throws. */
export async function loadCredits(fetchFn: typeof fetch, url: string): Promise<DatasetCredit[]> {
  try {
    const response = await fetchFn(url);
    if (!response.ok) return [];
    return parseCredits(await response.json());
  } catch {
    return [];
  }
}

export interface AboutScreen {
  element: HTMLElement;
  /** Read the manifest again and show its credits. */
  refresh(): Promise<void>;
}

/** Build the About screen (test id about-screen). */
export function createAboutScreen(): AboutScreen {
  const element = document.createElement('div');
  element.className = 'app-page';
  element.dataset.testid = 'about-screen';

  const title = document.createElement('h2');
  title.className = 'app-page-title';
  title.textContent = 'About';

  const disclaimer = document.createElement('p');
  disclaimer.dataset.testid = 'about-disclaimer';
  disclaimer.textContent = DISCLAIMER_TEXT;

  const versionLine = document.createElement('p');
  versionLine.dataset.testid = 'about-version';
  versionLine.textContent = `Version ${APP_VERSION}`;

  const creditsTitle = document.createElement('h3');
  creditsTitle.textContent = 'Anatomy data';
  const credits = document.createElement('div');
  credits.dataset.testid = 'about-credits';

  element.append(title, disclaimer, versionLine, creditsTitle, credits);

  const showCredits = (list: DatasetCredit[]): void => {
    if (list.length === 0) {
      const none = document.createElement('p');
      none.dataset.testid = 'about-no-dataset';
      none.textContent = PHANTOM_ONLY_TEXT;
      credits.replaceChildren(none);
      return;
    }
    const items = document.createElement('ul');
    for (const credit of list) {
      const item = document.createElement('li');
      item.dataset.testid = 'about-credit';
      const line = (label: string, value: string, testid: string): HTMLElement => {
        const row = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = `${label}: `;
        const text = document.createElement('span');
        text.dataset.testid = testid;
        text.textContent = value;
        row.append(name, text);
        return row;
      };
      item.append(
        line('Dataset', credit.sourceDataset, 'about-credit-dataset'),
        line('Licence', credit.licence, 'about-credit-licence'),
        line('Attribution', credit.attribution, 'about-credit-attribution'),
      );
      items.append(item);
    }
    credits.replaceChildren(items);
  };
  showCredits([]);

  const manifestUrl = `${import.meta.env.BASE_URL}data/manifest.json`;
  return {
    element,
    refresh: async () => showCredits(await loadCredits(fetch, manifestUrl)),
  };
}
