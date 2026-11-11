# Progress log — F12 App shell

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Each Playwright test gets a fresh browser context, so local storage starts empty in every test; only `page.reload()` inside one test carries saved values over.
- To block local storage in a screen test: `page.addInitScript` that redefines `window.localStorage` with a getter that throws a `SecurityError` DOMException. `createSafeStorage` takes a getter for this reason (reaching `window.localStorage` itself throws).
- `acceptDisclaimer` first waits for `zone-app` (mounted in the same synchronous step that decides on the disclaimer), then accepts only if the accept button exists.
- To stub out WebGL2 in a screen test: `page.addInitScript` that wraps `HTMLCanvasElement.prototype.getContext` and returns null for 'webgl2' (other context ids go to the original).
- `.claude/ralph-loop.local.md` is the loop's own state file; it is listed in `.git/info/exclude` (local only) and is never committed.

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
