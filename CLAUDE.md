# Project: Spine Fluoro Trainer (working title)

A browser-based simulator for physicians training in fluoroscopy-guided spine injections. Learners practise reading fluoroscopic images, positioning a virtual C-arm, and steering a realistic needle. It works on laptops and touch tablets.

## About the owner
I'm tech-savvy but not a programmer. Explain choices in plain language, avoid jargon, and tell me exactly what to run or click when I need to do something myself.

## Source of truth — read these before starting any task
- `docs/SPEC.md` — what the product must do (features with testable acceptance criteria)
- `docs/ARCHITECTURE.md` — the big picture, including the work zones that decide which features can be built in parallel
- `docs/DECISIONS.md` — past decisions and why. Don't reverse one without asking me.
- `PLAN.md` — roadmap: which features exist, their status and branch
- `ralph/tasks/*.json` — the small stories for each feature, with status (`todo` / `done` / `blocked`)
- `ralph/progress/*.md` — append-only log of what each loop round did and learned

If my request conflicts with these documents, point it out and ask before proceeding.

## Tech stack
- Language/framework: TypeScript + Vite (static website), Three.js on WebGL2 for graphics and the X-ray (DRR) shader
- Tests: Vitest (unit), Playwright 1.63.0 with Chromium (screens, desktop + touch-tablet set-ups)
- Lint/types: ESLint + `tsc --noEmit`
- Database/storage: none — anatomy files in `public/data/`, learner history in the browser's local storage
- Hosting/deployment: none yet (free static hosting later, set up by the owner — loops never deploy)

## Commands
- Install: `npm install`
- Run locally: `npm run dev` (then open http://localhost:5173)
- Unit tests: `npm test`
- Screen tests: `npm run test:e2e`
- Lint + type check: `npm run lint` (type check alone: `npm run typecheck`)
- Everything (lint, types, unit, screen tests) — run before calling anything done: `npm run check`
- Production build: `npm run build`
- Convert anatomy (interactive sessions only): `npm run anatomy:convert -- <input-folder> <output-folder>`

## Two ways of working
- **Interactive session (with me):** planning, reviews, bugs, decisions. Plan before coding and wait for my OK on anything bigger than a small fix.
- **Loop round (Ralph):** follow `ralph/PROMPT_build.md` exactly. One story per round, then stop. Never ask me questions in a loop round — if a human decision is needed, mark the story `blocked` and explain why in its notes.

## How to work (both modes)
1. **Small steps.** One story or fix at a time. Don't refactor unrelated code.
2. **Ask, don't guess.** Don't invent features or requirements. Ambiguity → ask (interactive) or block (loop).
3. **Tests first.** Write or extend tests for the acceptance criteria, then make them pass. Run the full test suite before calling anything done, and report results honestly — including failures.
4. **Green commits only.** Commit after each working step with a clear message. Never commit failing code. Never commit to `main` — always work on a branch.
5. **Keep docs current.** Loop rounds update only their own task file and progress log. Interactive sessions update `PLAN.md`, `docs/DECISIONS.md` and `docs/ARCHITECTURE.md` when things change.
6. **Prefer simple.** The simplest approach that meets the spec. No new dependencies unless clearly needed — and say so when you add one.

## Test integrity (non-negotiable)
- Never modify, skip, weaken or delete an existing test to make it pass. If a test seems wrong, stop: ask me (interactive) or block the story (loop).
- Never mark a story `done` without running its verify command and the full test suite.

## Security rules (non-negotiable)
- Never put secrets (API keys, passwords, tokens) in code, commits, or logs. Never read `.env`. Keep `.env.example` updated with placeholder values only.
- Never use real personal or customer data in tests or examples; use fake data.
- Validate all user input. Never build database queries or shell commands by gluing strings together with user input.
- Never deploy, never push to `main`, never force-push. Ask before anything that deletes data or changes settings outside this repo.

## Project-specific rules and lessons learned
<!-- Promoted from the "Lessons" sections of ralph/progress/*.md after a loop's work is merged. Loop rounds don't edit this file. -->
- Never run `playwright install` (or `npx playwright install`) in cloud sessions — Chromium for Playwright 1.63.0 is pre-installed; keep `@playwright/test` pinned to `1.63.0`.
- Tests use the synthetic phantom (`src/core/phantom.ts`), never the real CT files.
- Downloading or converting the real CT dataset happens only in interactive sessions with the owner. Loops use only the committed files in `public/data/`. Raw downloads go in `data-raw/` (git-ignored).
- Clinical data files (procedure cases, needle `params.json`, `tissues.json`, quiz bank) stay `draft` / `reviewedByOwner: false`. Only the owner marks them reviewed.
- Never copy text or images from textbooks into the app.
- Every screen test must pass in both Playwright set-ups (`desktop` and `tablet`).
- Only the app zone edits `src/app/main.ts`. Changes to `src/core/` are shared-file changes (see `docs/ARCHITECTURE.md`).

### Tool versions (from F0)
- Stay on TypeScript 6.0.x: typescript-eslint 8.72.x supports only TypeScript < 6.1. Move to TypeScript 7 only when typescript-eslint supports it (an interactive change to `package.json`).
- `tsconfig.json` type-checks only the folders in its `include` list (`src`, `tests`, `tools`, `*.config.ts`). A new top-level code folder must be added there (a shared-file change).

### Screen tests (from F0)
- Never start `npm run dev` yourself in a loop round; Playwright's `webServer` starts the dev server.
- After `page.goto('/')`, get past the disclaimer with `acceptDisclaimer(page)` from `tests/fixtures/acceptDisclaimer.ts` (clicks on desktop, taps on tablet).
- `window.__sim` is installed asynchronously. Read it through `getSimState(page)` from `tests/fixtures/simPage.ts`, which waits for it; take an image with `takeImage(page)` (spacebar on desktop, tap on Shot on tablet).
- `setPose(page, …)` in `tests/fixtures/simPage.ts` sets the C-arm pose directly through the store. Once F3's real controls exist, new screen tests that are about using the app move the C-arm through the controls. Tests that need an exact pose to compare pixels (the render zone's image tests) may keep using `setPose`.
- A test for one set-up only: `test.skip(({ hasTouch }) => hasTouch, 'desktop set-up only')` (or `!hasTouch` for tablet) inside a `describe`. Every behaviour still needs a test in both set-ups.
- To see browser console errors (e.g. shader compile logs), use a throwaway spec with `page.on('console', …)` and delete it afterwards.

### Unit tests (from F6)
- Vitest's default limit is 5 s per test. A test that renders whole images with the CPU reference (`renderDrrCpu`) can take 4–6 s on a 4-core cloud machine, so give it its own limit as the last argument of `it(…)` (e.g. `}, 20_000); // why`) when you write it. Don't raise `testTimeout` in `vitest.config.ts` (owner decision, see `docs/DECISIONS.md`). Loops may set a limit on tests they add in the same round, never on existing tests.

### 3D graphics (from F0)
- A Three.js `ShaderMaterial` with `glslVersion: GLSL3` has no `gl_FragColor`: declare `layout(location = 0) out highp vec4 outColor;` and write to that.
- An 8-bit `Data3DTexture` whose width is not a multiple of 4 needs `texture.unpackAlignment = 1`, or the image is skewed.
