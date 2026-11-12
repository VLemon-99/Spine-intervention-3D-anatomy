// App shell zone (disclaimer, home screen, layout; modes, history and About come in F12).
// mount() builds the home screen (F12.2) and the simulator screen: a slim top
// bar with a Home button above four panel slots that main.ts hands to the
// render, carm, needle and view3d zones, plus a slot for zones without a panel.
// Every zone is mounted once at start-up; the screens are only hidden and shown.
// The screen on show is written to data-screen on <html> ('home', 'sim').
import { store } from '../core/store';
import type { Mode } from '../core/types';

export interface AppLayout {
  fluoro: HTMLElement;
  carm: HTMLElement;
  needle: HTMLElement;
  view3d: HTMLElement;
  /** For zones that have no main panel yet (their markers live here). */
  other: HTMLElement;
}

let layout: AppLayout | null = null;

export type Screen = 'home' | 'sim';
const SCREEN_ATTRIBUTE = 'data-screen';

interface HomeChoice {
  testid: string;
  label: string;
  /** Missing for choices whose screens come in later stories (shown disabled). */
  mode?: Mode;
}

const HOME_CHOICES: HomeChoice[] = [
  { testid: 'home-practice', label: 'Practice' },
  { testid: 'home-exam', label: 'Exam' },
  { testid: 'home-quiz', label: 'Quiz' },
  { testid: 'home-freeplay', label: 'Free play', mode: 'freeplay' },
  { testid: 'home-history', label: 'History' },
  { testid: 'home-about', label: 'About' },
];

/** The slots created by the last mount(), or null before mounting. */
export function getLayout(): AppLayout | null {
  return layout;
}

export function mount(element: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; height: 100%; background: #10151c; color: #e6e9ee; font-family: system-ui, sans-serif; }
    #app { height: 100%; }
    #app [hidden] { display: none !important; }
    .app-button { min-width: 44px; min-height: 44px; font-size: 16px; cursor: pointer; }
    .app-home { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 24px; padding: 16px; box-sizing: border-box; }
    .app-home-title { margin: 0; font-size: 28px; }
    .app-home-choices { display: grid; grid-template-columns: repeat(2, minmax(160px, 240px)); gap: 12px; }
    .app-home-choices .app-button { min-height: 56px; font-size: 18px; }
    .app-sim { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
    .app-topbar { display: flex; align-items: center; gap: 8px; padding: 4px 8px 0; flex: none; }
    .app-layout { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px;
      flex: 1; min-height: 0; padding: 8px; box-sizing: border-box; }
    .app-slot { min-width: 0; min-height: 0; display: flex; }
    .app-slot > .panel { flex: 1; min-width: 0; min-height: 0; border: 1px solid #2c3542; border-radius: 6px;
      background: #18202a; padding: 8px; box-sizing: border-box; overflow: hidden; }
    .panel-title { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
  `;

  const root = document.createElement('div');
  root.className = 'app-layout';
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-app';
  marker.hidden = true;

  const slot = (name: string): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'app-slot';
    el.dataset.slot = name;
    return el;
  };
  const fluoro = slot('fluoro');
  const carm = slot('carm');
  const needle = slot('needle');
  const view3d = slot('view3d');
  const other = document.createElement('div');
  other.hidden = true;

  root.append(fluoro, carm, needle, view3d);

  const screens: Record<Screen, HTMLElement> = {
    home: document.createElement('div'),
    sim: document.createElement('div'),
  };
  const show = (screen: Screen): void => {
    for (const [name, el] of Object.entries(screens)) el.hidden = name !== screen;
    document.documentElement.setAttribute(SCREEN_ATTRIBUTE, screen);
  };

  // Simulator screen: top bar with the Home button, then the four panels.
  const sim = screens.sim;
  sim.className = 'app-sim';
  sim.dataset.testid = 'sim-screen';
  const topbar = document.createElement('div');
  topbar.className = 'app-topbar';
  const homeButton = makeButton('home-button', 'Home');
  homeButton.addEventListener('click', () => show('home'));
  topbar.append(homeButton);
  sim.append(topbar, root);

  // Home screen: the four choices plus History and About.
  const home = screens.home;
  home.className = 'app-home';
  home.dataset.testid = 'home-screen';
  const title = document.createElement('h1');
  title.className = 'app-home-title';
  title.textContent = 'Spine Fluoro Trainer';
  const choices = document.createElement('div');
  choices.className = 'app-home-choices';
  for (const choice of HOME_CHOICES) {
    const button = makeButton(choice.testid, choice.label);
    const mode = choice.mode;
    if (mode) {
      button.addEventListener('click', () => {
        store.set({ mode });
        show('sim');
      });
    } else {
      button.disabled = true;
      button.title = 'Coming soon';
    }
    choices.append(button);
  }
  home.append(title, choices);

  element.append(style, marker, home, sim, other);
  layout = { fluoro, carm, needle, view3d, other };
  show('home');
}

function makeButton(testid: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'app-button';
  button.dataset.testid = testid;
  button.textContent = label;
  return button;
}
