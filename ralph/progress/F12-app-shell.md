# Progress log — F12 App shell

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- Each Playwright test gets a fresh browser context, so local storage starts empty in every test; only `page.reload()` inside one test carries saved values over.
- To block local storage in a screen test: `page.addInitScript` that redefines `window.localStorage` with a getter that throws a `SecurityError` DOMException. `createSafeStorage` takes a getter for this reason (reaching `window.localStorage` itself throws).
- `acceptDisclaimer` first waits for `zone-app` (mounted in the same synchronous step that decides on the disclaimer), then accepts only if the accept button exists.

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
