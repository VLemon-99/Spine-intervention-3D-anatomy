# Progress log — F12 App shell

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Each Playwright test gets a fresh browser context, so local storage starts empty in every test; only `page.reload()` inside one test carries saved values over.
- To block local storage in a screen test: `page.addInitScript` that redefines `window.localStorage` with a getter that throws a `SecurityError` DOMException. `createSafeStorage` takes a getter for this reason (reaching `window.localStorage` itself throws).
- `acceptDisclaimer` first waits for `zone-app` (mounted in the same synchronous step that decides on the disclaimer), then accepts only if the accept button exists.
- To stub out WebGL2 in a screen test: `page.addInitScript` that wraps `HTMLCanvasElement.prototype.getContext` and returns null for 'webgl2' (other context ids go to the original).
- `.claude/ralph-loop.local.md` is the loop's own state file; it is listed in `.git/info/exclude` (local only) and is never committed.
- Screen tests that press 'I understand' directly (not via acceptDisclaimer) land on whatever the app shows next; once the home screen exists (F12-S3) that is the home screen, not the panels. Write such tests so they do not assume the next screen.
- `#app [hidden] { display: none !important; }` is needed: class rules like `.app-layout { display: grid }` otherwise override the hidden attribute.
- Keep exactly one element with test id home-button: Playwright's getByTestId fails (strict mode) when several match, even if only one is visible. All non-home screens share one top bar (`.app-shell`).
- `import { version } from '../../package.json'` type-checks and builds (moduleResolution bundler). In a Playwright spec, import JSON with `with { type: 'json' }`.
- Serve a fake manifest in a screen test with `page.route('**/data/manifest.json', route => route.fulfill({...}))` before `page.goto`.
- Screen tests can reach the app's own history instance by importing '/src/app/history.ts' inside page.evaluate (same trick as setPose with the store).
- In the app's one stylesheet (src/app/index.ts), a @media block must come after the rules it overrides (same specificity: later wins). `.app-slot` is defined near the end.
- Hidden panels still get the spacebar shortcut on desktop (the C-arm zone reads only data-disclaimer), so a desktop Shot test can pass while the simulator screen is hidden.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-11 06:58 — F12-S1 — done
- What I did: Added a never-throwing local-storage wrapper (read/write/remove/available, versioned keys). main.ts saves the disclaimer acceptance and skips the disclaimer on later loads; with storage blocked it shows it every load. Shared fixture acceptDisclaimer now returns straight away when the disclaimer is not shown (allowed by the story).
- Files touched: src/app/storage.ts (new), src/app/main.ts, src/app/disclaimer.ts (comment only), tests/fixtures/acceptDisclaimer.ts, tests/app/storage.test.ts (new), tests/e2e/app/rememberDisclaimer.spec.ts (new).
- Test result: verify command passed (6 unit, 58 screen). npm run check: lint + types OK, 182 unit passed, 192 screen passed (6 skipped). Note: in the baseline full unit run, tests/render/collimation.test.ts once timed out at 5 s under load; it passed on re-run and in every later run (not changed).
- Next round should know: use `appStorage` / `createSafeStorage` from src/app/storage.ts for F12-S6. Next eligible story is F12-S2 (WebGL2 check).

## Round — 2026-11-11 07:08 — F12-S2 — done
- What I did: Added a WebGL2 check (plain function, canvas factory passed in) and a readable message card. main.ts runs the check before mounting anything; without WebGL2 it shows only "This browser can't run the simulator (WebGL2 needed)" (test id webgl2-missing) — no panels, no disclaimer.
- Files touched: src/app/webgl2.ts (new), src/app/main.ts, tests/app/webgl2.test.ts (new), tests/e2e/app/webgl2.spec.ts (new).
- Test result: verify passed (4 unit, 6 screen). npm run check: lint + types OK, 186 unit passed, 198 screen passed (6 skipped).
- Next round should know: the dev-only test hook is still installed when WebGL2 is missing (harmless; no page errors). Next eligible story is F12-S3 (home screen + Free play).

## Round — 2026-11-11 07:25 — F12-S3 — blocked
- What I did: Built the home screen (six choices; History/About disabled; Free play sets mode 'freeplay'), a simulator screen with a top bar and Home button, data-screen on <html>, and the acceptDisclaimer fixture choosing Free play. home.spec.ts passed 10/10 and the other existing screen tests passed, but 3 runs of tests/e2e/app/rememberDisclaimer.spec.ts (from F12-S1) failed: they expect the panels / a Shot straight after the disclaimer. Changing that existing test is not allowed in a loop, so I blocked the story and discarded the code.
- Files touched: none kept (src/app/index.ts, tests/fixtures/acceptDisclaimer.ts, tests/e2e/app/home.spec.ts restored/removed). Only this log and the task file changed.
- Test result: branch is back at the F12-S2 state (full check passed there: 186 unit, 198 screen).
- Next round should know: the owner must decide (see F12-S3 notes). Design that worked: in src/app/index.ts, a home screen and a 'sim-screen' (flex column 100vh: top bar + the existing grid with flex:1, min-height:0); `#app [hidden] { display:none !important }` because .app-layout's display:grid overrides the hidden attribute; buttons with class app-button min 44×44. Fixture: after the disclaimer, if home-screen is visible, press home-freeplay. Stories that depend on F12-S3 (S4, S5, S7, S8, S9, S10, S11) cannot start until it is unblocked; F12-S6 is still eligible.

## Round — 2026-11-11 07:35 — F12-S6 — done
- What I did: Added the history store: records kept as a JSON array (in the order added) under spineFluoroTrainer.history.v1; list() sorts newest first by date, then last-added first. Everything read back is checked with toAttemptRecord (known fields only, score 0–100, valid date and mode, quiz records without procedure fields); a broken value gives []. add() refuses invalid records ('invalid') and never throws.
- Files touched: src/app/history.ts (new), tests/app/history.test.ts (new).
- Test result: verify passed (10 unit). npm run check: lint + types OK, 196 unit passed, 198 screen passed (6 skipped).
- Next round should know: F12-S3 is still blocked (owner decision on rememberDisclaimer.spec.ts), so every remaining todo story (S4, S5, S7–S11) waits on it. No story is eligible until the owner answers.

## Round — 2026-11-12 — F12-S3 — done
- What I did: Owner unblocked the story (may update rememberDisclaimer.spec.ts). Rebuilt the attempt-1 design: home screen (home-screen) with Practice, Exam, Quiz, Free play, History, About (all but Free play disabled for now); Free play sets mode 'freeplay' and shows sim-screen (top bar with home-button + the four-panel grid, still 100vh); data-screen on <html>. acceptDisclaimer now also presses Free play when the home screen is shown. rememberDisclaimer.spec.ts: only added a Free play press before the panel check (after reload) and before the Shot (storage blocked); disclaimer checks unchanged.
- Files touched: src/app/index.ts, tests/fixtures/acceptDisclaimer.ts, tests/e2e/app/home.spec.ts (new), tests/e2e/app/rememberDisclaimer.spec.ts.
- Test result: verify passed (home.spec 10/10, then the whole screen suite). npm run check: lint + types OK, 196 unit passed, 208 screen passed (6 skipped).
- Next round should know: screens live in a `screens` record inside mount() with a local `show(screen)`; S4/S5/S7 add 'procedures', 'quiz', 'about', 'history' there and enable their home buttons (home-history/home-about/home-practice/home-exam/home-quiz are currently disabled). Next eligible story: F12-S4.

## Round — 2026-11-12 — F12-S4 — done
- What I did: Practice / Exam set mode 'practice' / 'exam' and open the procedure picker (procedure-picker; h2 'Practice'/'Exam', test id procedure-picker-title; procedure-picker-empty 'No procedures available yet'); Quiz sets mode 'quiz' and opens quiz-screen, into which main.ts now mounts the quiz zone (layout.quiz). Restructured so every non-home screen sits in one `.app-shell` (100vh flex column) under a single top bar with home-button; the sim grid itself carries test id sim-screen. data-screen: 'procedures' / 'quiz'.
- Files touched: src/app/index.ts, src/app/main.ts, tests/e2e/app/modes.spec.ts (new).
- Test result: verify passed (modes + panels: 16). npm run check: lint + types OK, 196 unit passed, 218 screen passed (6 skipped).
- Next round should know: add new screens (about, history) to `shellScreens` and the `Screen` type in src/app/index.ts, and give their home buttons `screen` (no mode) in HOME_CHOICES — the click handler currently needs both mode and screen, so it must be loosened for About/History (they do not change the mode). Next eligible story: F12-S5.

## Round — 2026-11-12 — F12-S5 — done
- What I did: Added the About screen (about-screen) opened by home-about: the disclaimer (about-disclaimer, same DISCLAIMER_TEXT constant as the disclaimer screen), 'Version <package.json version>' (about-version) and the dataset credits (about-credit with -dataset/-licence/-attribution), read from data/manifest.json on each open. Only text fields are used, set with textContent; a region with non-text fields is left out. Missing/invalid/empty manifest → about-no-dataset phantom-only text. The home-screen click handler now allows a screen without a mode.
- Files touched: src/app/about.ts (new), src/app/disclaimer.ts, src/app/index.ts, tests/app/about.test.ts (new), tests/e2e/app/about.spec.ts (new).
- Test result: verify passed (about.spec 16/16; about.test 3/3). npm run check: lint + types OK, 199 unit passed, 234 screen passed (6 skipped).
- Next round should know: next eligible story is F12-S7 (History screen; uses `history` from src/app/history.ts). F12-S8 (layout) is also eligible after it.

## Round — 2026-11-12 — F12-S7 — done
- What I did: Added the History screen (history-screen) from home-history: entries (history-entry) newest first with date, mode, procedure id or 'Quiz', 'Score N', 'N shots', 'Fluoro N.N s', and an 'Unsafe' mark (history-unsafe); history-empty when there are none; history-clear opens an in-page dialog (history-clear-dialog, -confirm, -cancel); history-unavailable "History can't be saved in this browser" when storage is blocked. The screen re-reads the history each time it opens.
- Files touched: src/app/historyScreen.ts (new), src/app/index.ts, tests/e2e/app/history.spec.ts (new).
- Test result: verify passed (12/12). npm run check: lint + types OK, 199 unit passed, 246 screen passed (6 skipped).
- Next round should know: history entries show the procedure id, not its title (titles come with store.procedures; F12-S10/S11 may improve this only if a story asks). F12-S11 must refresh the screen if it is open when 'attemptFinished' arrives (historyScreen.refresh()). Next eligible story: F12-S8 (layout).

## Round — 2026-11-12 — F12-S8 — done
- What I did: Added a portrait layout with CSS only: `@media (orientation: portrait)` makes the shell grow with its content, the grid one column (DOM order = fluoro, C-arm, needle, 3D view), the fluoro slot square, the other slots at least 320 px. Landscape layout was already within the viewport; the new test checks it at 1280×800 and 1024×768. Checked a portrait screenshot by eye: image readable, panels stacked.
- Files touched: src/app/index.ts, tests/e2e/app/layout.spec.ts (new).
- Test result: verify passed (layout 6/6, then the whole screen suite). npm run check: lint + types OK, 199 unit passed, 252 screen passed (6 skipped).
- Next round should know: next eligible story is F12-S9 (touch-target check of every app-zone screen) — F12-S10 is also eligible; S9 has the lower priority number.
