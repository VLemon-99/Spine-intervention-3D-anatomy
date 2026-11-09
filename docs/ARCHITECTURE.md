# Architecture

> The bird's-eye view. Keep this short and current — it's what a fresh agent, loop round or reviewer reads to understand the whole system.

## Overview
A static website: TypeScript, built with Vite. It runs entirely in the browser, with no server and no database. The anatomy is a CT-derived 3D volume (intensity + tissue labels + vertebral level) loaded from files in `public/data/`. The C-arm pose and the needle state live in one central store. The renderer turns the volume, pose, needle and contrast into a fluoroscopic image on the GPU (WebGL2 through Three.js), using X-ray absorption maths (a DRR). Needle physics, tissue events, contrast spread and scoring are plain TypeScript with no screen code. That keeps them fully unit-testable against a small synthetic phantom.

## Components
| Component | What it does | Where it lives |
|---|---|---|
| Core (shared contracts) | Shared types (`Volume`, `CArmPose`, `NeedleState`, `TissueEvent`, `AttemptRecord`), tissue label list, C-arm projection geometry, central state store + event bus, seeded random numbers, synthetic phantom, `window.__sim` test hook | `src/core/` |
| App shell | Disclaimer, home screen, modes (Practice / Exam / Quiz / Free play), layout, history (browser storage), About page, WebGL2 check. `main.ts` mounts every zone's panel | `src/app/` |
| Anatomy | Converter script (NIfTI → web format), soft-tissue modeller, region loader, landmarks | `tools/anatomy/`, `src/anatomy/`, `public/data/` |
| Renderer | GPU DRR shader, CPU reference DRR, display (invert, noise, collimation, magnification, flip), needle and contrast in the image, fluoro panel | `src/render/` |
| C-arm | Pose limits, sliders/keys/touch controls, single shot, continuous fluoro, last image hold, shot/fluoro-time counters, region picker | `src/carm/` |
| Needle | Needle catalogue, physics model (fulcrum, bevel drift, bending, pre-bend, bone stop, track memory), handling controls, needle panel | `src/needle/` |
| Sim | Tissue at tip, resistance, loss of resistance, safety events, aspiration, event log | `src/sim/` |
| 3D view | Three.js scene: bone surface, needle, C-arm, beam, layer toggles | `src/view3d/` |
| Contrast | Contrast spread by compartment, washout, extra absorption volume for the renderer | `src/contrast/` |
| Procedures | Case files (rules as data), case flow, scoring, target overlay | `src/procedures/` |
| Quiz | Question bank, quiz screen, quiz scoring | `src/quiz/` |

## How data flows
1. **Load:** the app shell asks the anatomy loader for a region. It reads `public/data/manifest.json` and the region files and puts a `Volume` (+ landmarks) in the store. Tests use the synthetic phantom from `src/core/phantom.ts` instead.
2. **Position:** C-arm controls update the `CArmPose` in the store. `src/core/geometry.ts` turns the pose into a source point, a detector plane and project/unproject functions.
3. **Expose:** a shot (or each continuous-fluoro frame) emits an `exposure` event. The renderer draws a DRR from the volume + pose + needle curve + contrast volume, and keeps it on screen (last image hold). Counters update.
4. **Needle:** needle controls send hand actions (angle, advance, rotate bevel) to the needle model. It computes the new shaft curve using tissue labels from the volume, and stores the `NeedleState`.
5. **Feel & events:** the sim reads the tissue at the tip after each needle step and emits `TissueEvent`s (loss of resistance, bone contact, dural puncture, nerve contact, intravascular…).
6. **Contrast:** an injection makes the contrast module add to a contrast volume according to the compartment at the tip. The renderer adds it on the next image.
7. **Score:** the procedures module watches exposures, needle state and events. On **Finish** it scores the attempt and hands an `AttemptRecord` to the app shell, which saves it in the browser.

The 3D view only reads the store; it never changes it.

## Conventions
- **Coordinates:** patient-based, in millimetres. +x = patient's left, +y = toward the back (posterior), +z = toward the head. Patient prone. The C-arm isocentre is the origin of the table-relative frame.
- **Units:** mm and degrees in all public functions; radians only inside maths code.
- **Determinism:** anything random takes a seed from `src/core/random.ts`.
- **Clinical data files** (`params.json`, `tissues.json`, case files, quiz bank) carry a `status` or `reviewedByOwner` field. Loops write `draft` or `false`; only the owner changes them.
- **UI:** each zone exports `mount(element)` from its `index.ts` and builds its own panel. Only the app zone edits `src/app/main.ts`. Interactive elements get `data-testid` attributes.
- **Test hook:** `window.__sim` is created in `src/core/testHook.ts` only when `import.meta.env.DEV` or test mode is on. Zones register read-only getters for their state through it.

## Work zones (for parallel loops)
Each zone is a set of folders. Two loops can run at the same time only if their features touch **different zones**. Every story in `ralph/tasks/` names its zone.

| Zone | Folders | Features | Notes |
|---|---|---|---|
| core | `src/core/`, `tests/core/` | F0 only | **Shared** — see below |
| app | `src/app/`, `tests/app/`, `tests/e2e/app/` | F0, F12 | Owns `main.ts` |
| anatomy | `src/anatomy/`, `tools/anatomy/`, `public/data/`, `tests/anatomy/`, `tests/e2e/anatomy/` | F1 | Real CT download/convert only in interactive sessions |
| render | `src/render/`, `tests/render/`, `tests/e2e/render/` | F2, F7 | |
| carm | `src/carm/`, `tests/carm/`, `tests/e2e/carm/` | F3 | |
| needle | `src/needle/`, `tests/needle/`, `tests/e2e/needle/` | F4, F5 | |
| sim | `src/sim/`, `tests/sim/`, `tests/e2e/sim/` | F6 | |
| view3d | `src/view3d/`, `tests/view3d/`, `tests/e2e/view3d/` | F8 | |
| contrast | `src/contrast/`, `tests/contrast/`, `tests/e2e/contrast/` | F9 | |
| procedures | `src/procedures/`, `tests/procedures/`, `tests/e2e/procedures/` | F10 | |
| quiz | `src/quiz/`, `tests/quiz/`, `tests/e2e/quiz/` | F11 | |

**Shared files.** Changes to these must not happen in parallel loops. Do them in F0, in a single loop, or interactively. A loop story that needs one of them changed must be marked `blocked` unless the story explicitly says it may:
- `package.json`, `package-lock.json` (dependencies)
- `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts`, `index.html`
- `src/core/**` (shared types, labels, geometry, store, phantom, test hook)
- `tests/fixtures/**` (shared test helpers)
- `CLAUDE.md`, `PLAN.md`, `docs/`, `.claude/settings.json`

A zone may define its own internal types freely. `src/core/` holds only what crosses zones.

**Dependency order:**
- F0 first, alone.
- Wave 1 (parallel after F0): F1, F2, F3, F4, F8, F12.
- Wave 2: F5 (needs F3, F4), F6 (needs F4), F7 (needs F2, F4), F11 (needs F1, F2).
- Wave 3: F9 (needs F2, F6).
- Wave 4: F10 (needs F1, F3, F5, F6, F9).
- F4 → F5 and F2 → F7 share a zone, so they always run one after the other.

## External services
- None at runtime.
- Anatomy source (download only, in interactive sessions): the TotalSegmentator dataset (CC BY 4.0, Zenodo), with VerSe as a fallback. Only converted, size-limited files are committed to `public/data/`. Raw downloads go in `data-raw/`, which is git-ignored.

## Known technical risks
- **Software GPU in tests:** headless Chromium renders WebGL2 with SwiftShader (a software GPU). It is slow but deterministic. Playwright may need launch flags such as `--use-angle=swiftshader` / `--enable-unsafe-swiftshader` (F0 sets this up). Speed is never tested automatically.
- **Tablet memory:** 8-bit volumes per region keep GPU memory low enough for iPads. Don't go to 16-bit without checking.
- **Soft tissue is modelled, not segmented:** nerve roots, ligamentum flavum and small arteries are approximations and need the owner's review.

## Folder map
```
src/
  core/        shared contracts (types, labels, geometry, store, phantom, test hook)
  app/         shell: disclaimer, home, modes, layout, history, about; main.ts
  anatomy/     region loader, landmarks
  render/      DRR (GPU + CPU reference), display, fluoro panel
  carm/        C-arm/table controls, exposure, counters
  needle/      needle catalogue, physics, handling controls
  sim/         tissue feel, events, aspiration
  view3d/      3D see-through view
  contrast/    contrast spread and washout
  procedures/  case files, case flow, scoring
  quiz/        question bank, quiz screen
tools/anatomy/ NIfTI → web-format converter, soft-tissue modeller
public/data/   converted anatomy regions + manifest + landmarks
tests/         unit tests per zone; tests/e2e/<zone>/ screen tests; tests/fixtures/ shared helpers
docs/          spec, architecture, decisions, prompts
ralph/         loop prompts, task files, progress logs, loop script
```
