# Progress log — F0 Walking skeleton

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- TypeScript 7.x is NOT supported by typescript-eslint 8.72.1 (peer range `>=4.8.4 <6.1.0`); stay on TypeScript 6.0.x until typescript-eslint widens its range.
- Node tooling in tests (`node:fs`, `node:url`) type-checks because `@types/node` is a dev dependency and `tsconfig.json` lists `"types": ["vite/client", "node"]`.
- `tsconfig.json` includes `src`, `tests` and `*.config.ts`; anything new outside those (e.g. `tools/`, `playwright.config.ts` is covered by `*.config.ts`) must be added to `include` to be type-checked.
- Running `npm run dev` in the background from a loop round was denied by the sandbox permissions; screen tests should start the dev server through Playwright's `webServer` instead.

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-09 07:04 — F0-S1 — done
- What I did: Created the TypeScript + Vite project skeleton with exact dependency versions (three 0.187.0; dev: @eslint/js 10.0.1, @playwright/test 1.63.0, @types/node 22.20.5, @types/three 0.187.0, eslint 10.14.0, typescript 6.0.3, typescript-eslint 8.72.1, vite 8.3.6, vitest 5.1.0). Strict tsconfig, Vite dev server on 5173 with strictPort, ESLint flat config with typescript-eslint, Vitest in the node environment (tests/**/*.test.ts, tests/e2e excluded), index.html titled 'Spine Fluoro Trainer', minimal src/app/main.ts. Scripts: dev, build, test, lint, typecheck, check (lint + typecheck + test for now). Wrote tests/core/project-config.test.ts first (6 tests). New dependencies beyond the story list: @types/node (type-checking node:fs in tests) and @eslint/js (base lint rules). Did NOT run playwright install.
- Files touched: package.json, package-lock.json, tsconfig.json, vite.config.ts, vitest.config.ts, eslint.config.js, index.html, src/app/main.ts, tests/core/project-config.test.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify command passed (npm install; project-config 6/6; npm run check: lint, typecheck, unit 6/6; npm run build OK). Baseline before this story: no test suite (expected).
- Next round should know: `npm run build` runs `tsc --noEmit` before `vite build`. `npm install` reports 10 moderate audit warnings (dev tooling); not addressed. F0-S2 must extend `check` to add screen tests and add the test:e2e script.

## Round — 2026-11-09 07:06 — F0-S2 — done
- What I did: Added playwright.config.ts with exactly two projects, 'desktop' (1280×800) and 'tablet' (1024×768, hasTouch + isMobile), Chromium only, trace off, SwiftShader launch flags for WebGL2, webServer 'npm run dev' on http://localhost:5173 (reuses a running server unless CI). Added script test:e2e and extended check to lint → typecheck → unit → screen tests. First screen tests (tests/e2e/app/smoke.spec.ts): page title and WebGL2 context. Extended tests/core/project-config.test.ts with two tests (projects, test:e2e script). Did not run playwright install.
- Files touched: playwright.config.ts, package.json, tests/core/project-config.test.ts, tests/e2e/app/smoke.spec.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify command passed: --list shows each of the 2 screen tests under desktop and tablet; project-config 8/8; screen tests 4/4; npm run check passed; build OK.
- Next round should know: Playwright's webServer starts the dev server by itself, so screen tests just need `npx playwright test <path>`. The loop-state file .claude/ralph-loop.local.md is excluded locally via .git/info/exclude (never commit it).
