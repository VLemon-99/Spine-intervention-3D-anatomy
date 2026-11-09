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

## Round — 2026-11-09 07:07 — F0-S3 — done
- What I did: Added dev dependency tsx 4.23.15 (exact) and the npm script anatomy:convert ("tsx tools/anatomy/convert.ts"). Created the placeholder tools/anatomy/convert.ts: with fewer than two folders it prints "Usage: npm run anatomy:convert -- <input-folder> <output-folder>" and exits 1; otherwise prints that conversion comes in F1 and exits 1. Added "tools" to tsconfig.json include. Tests written first: tests/anatomy/convert-cli.test.ts (spawnSync npm with a fixed argument list, no shell) and one more project-config test.
- Files touched: package.json, package-lock.json, tsconfig.json, tools/anatomy/convert.ts, tests/anatomy/convert-cli.test.ts, tests/core/project-config.test.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify passed (npm install; convert-cli + project-config 10/10; lint OK). npm run check passed (unit 10/10, screen 4/4); build OK.
- Next round should know: the convert script sets process.exitCode instead of calling process.exit, so F1 can make main() async without losing output.

## Round — 2026-11-09 07:09 — F0-S4 — done
- What I did: Created src/core/labels.ts (TISSUE ids 0–13 with display names, isBone, LEVEL_CODES C1…ilium with LEVEL_IDS 1–26, NO_LEVEL = 0, levelCodeFromId, SIDES) and src/core/types.ts (Vec3, Sided, Volume, Endplate, LevelLandmarks, Landmarks, Mode, CArmPose, NeedleState, TissueEventType, ContrastCompartment, TissueEvent, ProcedureAttemptRecord/QuizAttemptRecord → AttemptRecord), with the coordinate/unit conventions in comments. Tests first: tests/core/labels.test.ts and tests/core/types.test.ts (examples of every type, '@ts-expect-error' for a bad Mode, a bad TissueEvent type and a quiz record with shots).
- Files touched: src/core/labels.ts, src/core/types.ts, tests/core/labels.test.ts, tests/core/types.test.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify passed (labels + types 8/8; typecheck OK). npm run check passed (unit 18/18, screen 4/4).
- Next round should know: Volume voxel index = i + size.x * (j + size.y * k); origin is the centre of voxel (0,0,0); orientation gives the patient direction of the i, j, k axes. Table offsets map leftRight→x, height→y, headFoot→z (patient moves by the offset relative to the isocentre). See the story notes for review points in types.ts.

## Round — 2026-11-09 07:10 — F0-S5 — done
- What I did: Created src/core/store.ts (SimState with pose, shotCount, fluoroTimeSeconds, lastImagePose, mode, volume, landmarks, needle, contrast; createStore with get/set/subscribe — set notifies once per call and only if a field actually changed; typed event bus with exposure, caseStart and tissueEvent; shared instances `store` and `bus`) and src/core/random.ts (createRandom(seed), mulberry32). Tests first: tests/core/store.test.ts, tests/core/random.test.ts.
- Files touched: src/core/store.ts, src/core/random.ts, tests/core/store.test.ts, tests/core/random.test.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify passed (13/13). npm run check passed (unit 31/31, screen 4/4).
- Next round should know: bus.emit('exposure') takes no payload; bus.emit('tissueEvent', event) requires one (type-checked). Store compares fields with Object.is, so always pass new objects/arrays when changing a pose or needle.

## Round — 2026-11-09 07:13 — F0-S6 — done
- What I did: Created src/core/phantom.ts: createPhantom() builds a deterministic 95×95×95, 1 mm Volume (region 'phantom') from simple boxes and cylinders: two vertebra blocks (body, pedicles, lamina, articular pillars; cortical within 2 mm of a box face, cancellous deeper), a disc, facet joint spaces at z = 0, canal (epidural, thecal sac, cord), ligamentum flavum between the laminae, nerve roots through both foramina, an artery and a vein, muscle, a 4 mm skin/fat layer and an air margin. Exported PHANTOM_TEST_POINTS (block centres, foramen centres, midline line). Tests first: tests/core/phantom.test.ts, with helpers in tests/core/phantomHelpers.ts (not a test file).
- Files touched: src/core/phantom.ts, tests/core/phantom.test.ts, tests/core/phantomHelpers.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify passed (phantom 8/8). npm run check passed (unit 39/39, screen 4/4).
- Next round should know: Block centres (0, −12, ±14); foramen centres (±13, 5, 0); L4 superior articular process tips sit at the top of the upper pillars (±15, 18, 26), L5's at (±15, 18, −1); pedicle box centres (±11, 7, ±17). Endplates: upper body z 4…24, lower −24…−4. tests/core/phantomHelpers.ts has voxelIndexAt / voxelCentre / forEachVoxelNear for S7.

## Round — 2026-11-09 07:14 — F0-S7 — done
- What I did: Extended src/core/phantom.ts: 8-bit intensity per tissue (INTENSITY_BY_LABEL), a levels volume (bone at z > 0 = L4, z < 0 = L5, everything else 0), and createPhantomLandmarks() returning Landmarks for region 'phantom' with L4 and L5 entries (body, pedicle, endplate centres + unit normals, superior articular process tips; foramen centres under L4 equal to PHANTOM_TEST_POINTS.foramenCentres). Tests first: 9 new tests in tests/core/phantom.test.ts.
- Files touched: src/core/phantom.ts, tests/core/phantom.test.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify passed (phantom 17/17, typecheck OK). npm run check passed (unit 48/48, screen 4/4).
- Next round should know: createPhantom() takes ~0.2 s; call it once per test file. For the DRR (F0-S15), intensity 0 = air, so absorption from intensity alone keeps air fully bright.

## Round — 2026-11-09 07:16 — F0-S8 — done
- What I did: Created src/core/geometry.ts: createProjection(pose) returns source, detector centre, beam direction, detector right/up axes, isocentre (= −table offsets in patient coordinates), pixel size, and project(point) → pixel / unproject(pixel) → ray, all in patient coordinates. Rotation = tilt about x (cranial +), then oblique about z (right +). Named constants for typical mobile C-arm distances. Tests first: tests/core/geometry.test.ts (63 poses incl. table offsets for the isocentre check; 10 poses × 50 seeded points for the round trip; AP, lateral, ±25° oblique, ±20° tilt; image orientation).
- Files touched: src/core/geometry.ts, tests/core/geometry.test.ts, ralph/tasks/F0-skeleton.json, ralph/progress/F0-skeleton.md
- Test result: verify passed (geometry 8/8). npm run check passed (unit 56/56, screen 4/4).
- Next round should know: pixel (i, j) has its centre at (i + 0.5, j + 0.5); the image centre (256, 256) is a pixel corner. For the shader (F0-S14), a pixel's ray is unproject({x: i + 0.5, y: j + 0.5}); in WebGL gl_FragCoord.y counts from the bottom, so row j = 511 − floor(gl_FragCoord.y) unless the canvas is read back flipped.
