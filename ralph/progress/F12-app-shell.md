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
