// App shell zone (disclaimer, home screen, modes, layout, About, History).
// mount() builds the home screen (F12.2) and, below one slim top bar with the
// Home button, the other screens: the simulator screen (four panel slots that
// main.ts hands to the render, carm, needle and view3d zones), the procedure
// picker (Practice / Exam), the quiz screen (a slot for the quiz zone) and the
// About and History pages, plus a hidden slot for zones without a panel.
// Every zone is mounted once at start-up; the screens are only hidden and shown.
// The screen on show is written to data-screen on <html> ('home', 'sim',
// 'procedures', 'quiz', 'about', 'history'). The mode is set when a choice is made on the home screen.
import { store } from '../core/store';
import type { Mode } from '../core/types';
import { createAboutScreen } from './about';
import { history } from './history';
import { createHistoryScreen } from './historyScreen';

export interface AppLayout {
  fluoro: HTMLElement;
  carm: HTMLElement;
  needle: HTMLElement;
  view3d: HTMLElement;
  /** The quiz screen's content, for the quiz zone (F11). */
  quiz: HTMLElement;
  /** For zones that have no main panel yet (their markers live here). */
  other: HTMLElement;
}

let layout: AppLayout | null = null;

export type Screen = 'home' | 'sim' | 'procedures' | 'quiz' | 'about' | 'history';
type ShellScreen = Exclude<Screen, 'home'>;
const SCREEN_ATTRIBUTE = 'data-screen';

interface HomeChoice {
  testid: string;
  label: string;
  /** The mode set by this choice (About and History do not change it). */
  mode?: Mode;
  /** Missing for choices whose screens come in later stories (shown disabled). */
  screen?: ShellScreen;
}

const HOME_CHOICES: HomeChoice[] = [
  { testid: 'home-practice', label: 'Practice', mode: 'practice', screen: 'procedures' },
  { testid: 'home-exam', label: 'Exam', mode: 'exam', screen: 'procedures' },
  { testid: 'home-quiz', label: 'Quiz', mode: 'quiz', screen: 'quiz' },
  { testid: 'home-freeplay', label: 'Free play', mode: 'freeplay', screen: 'sim' },
  { testid: 'home-history', label: 'History', screen: 'history' },
  { testid: 'home-about', label: 'About', screen: 'about' },
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
    .app-shell { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
    .app-topbar { display: flex; align-items: center; gap: 8px; padding: 4px 8px 0; flex: none; }
    .app-layout { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px;
      flex: 1; min-height: 0; padding: 8px; box-sizing: border-box; }
    .app-page { flex: 1; min-height: 0; overflow: auto; padding: 16px; box-sizing: border-box; }
    .app-page-title { margin: 0 0 12px; font-size: 24px; }
    .app-history-list { padding-left: 24px; }
    .app-history-list li { margin: 0 0 8px; }
    .app-history-list li span, .app-history-list li strong { margin-right: 12px; }
    .app-history-list li strong { color: #ff8a80; }
    .app-dialog { position: fixed; inset: 0; z-index: 900; display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.6); padding: 16px; box-sizing: border-box; }
    .app-dialog-card { max-width: 420px; background: #18202a; border: 1px solid #2c3542; border-radius: 8px; padding: 16px; }
    .app-dialog-buttons { display: flex; gap: 12px; justify-content: flex-end; }
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

  // The simulator screen is the four-panel grid itself.
  root.dataset.testid = 'sim-screen';

  // Procedure picker (Practice / Exam). Listing the procedures is F12-S10.
  const picker = document.createElement('div');
  picker.className = 'app-page';
  picker.dataset.testid = 'procedure-picker';
  const pickerTitle = document.createElement('h2');
  pickerTitle.className = 'app-page-title';
  pickerTitle.dataset.testid = 'procedure-picker-title';
  const pickerEmpty = document.createElement('p');
  pickerEmpty.dataset.testid = 'procedure-picker-empty';
  pickerEmpty.textContent = 'No procedures available yet';
  picker.append(pickerTitle, pickerEmpty);

  // Quiz screen: the quiz zone builds its content in `quiz` (F11).
  const quizScreen = document.createElement('div');
  quizScreen.className = 'app-page';
  quizScreen.dataset.testid = 'quiz-screen';
  const quizTitle = document.createElement('h2');
  quizTitle.className = 'app-page-title';
  quizTitle.textContent = 'Quiz';
  const quiz = document.createElement('div');
  quizScreen.append(quizTitle, quiz);

  // About page (disclaimer, version, dataset credits).
  const about = createAboutScreen();
  const historyScreen = createHistoryScreen(history);

  // Every screen but home sits below one top bar with the Home button.
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  const topbar = document.createElement('div');
  topbar.className = 'app-topbar';
  const homeButton = makeButton('home-button', 'Home');
  topbar.append(homeButton);
  shell.append(topbar, root, picker, quizScreen, about.element, historyScreen.element);

  const home = document.createElement('div');
  const shellScreens: Record<ShellScreen, HTMLElement> = {
    sim: root,
    procedures: picker,
    quiz: quizScreen,
    about: about.element,
    history: historyScreen.element,
  };
  const show = (screen: Screen): void => {
    home.hidden = screen !== 'home';
    shell.hidden = screen === 'home';
    for (const [name, el] of Object.entries(shellScreens)) el.hidden = name !== screen;
    document.documentElement.setAttribute(SCREEN_ATTRIBUTE, screen);
  };
  homeButton.addEventListener('click', () => show('home'));

  // Home screen: the four choices plus History and About.
  home.className = 'app-home';
  home.dataset.testid = 'home-screen';
  const title = document.createElement('h1');
  title.className = 'app-home-title';
  title.textContent = 'Spine Fluoro Trainer';
  const choices = document.createElement('div');
  choices.className = 'app-home-choices';
  for (const choice of HOME_CHOICES) {
    const button = makeButton(choice.testid, choice.label);
    const { mode, screen } = choice;
    if (screen) {
      button.addEventListener('click', () => {
        if (mode) store.set({ mode });
        if (screen === 'procedures') pickerTitle.textContent = choice.label;
        if (screen === 'about') void about.refresh();
        if (screen === 'history') historyScreen.refresh();
        show(screen);
      });
    } else {
      button.disabled = true;
      button.title = 'Coming soon';
    }
    choices.append(button);
  }
  home.append(title, choices);

  element.append(style, marker, home, shell, other);
  layout = { fluoro, carm, needle, view3d, quiz, other };
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
