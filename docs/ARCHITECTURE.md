# Architecture

> The bird's-eye view. Keep this short and current — it's what a fresh agent, loop round or reviewer reads to understand the whole system.

## Overview
A static website: TypeScript, built with Vite. It runs entirely in the browser, with no server and no database. The anatomy is a CT-derived 3D volume (intensity + tissue labels + vertebral level) loaded from files in `public/data/`. The C-arm pose and the needle state live in one central store. The renderer turns the volume, pose, needle and contrast into a fluoroscopic image on the GPU (WebGL2 through Three.js), using X-ray absorption maths (a DRR). Needle physics, tissue events, contrast spread and scoring are plain TypeScript with no screen code. That keeps them fully unit-testable against a small synthetic phantom.

## Components
| Component | What it does | Where it lives |
|---|---|---|
| Core (shared contracts) | Shared types (`Volume`, `Landmarks`, `Mode`, `CArmPose`, `NeedleState`, `TissueEvent`, `AttemptRecord`), tissue label list, C-arm projection geometry, central state store (pose, shot count, fluoro time, last image pose and kind, mode, volume, landmarks, needle state, contrast volume, list of regions on offer, list of procedures on offer) + event bus (`exposure`, `caseStart`, `tissueEvent`, `regionRequest`, `procedureRequest`, `attemptFinished`, `imageTap`), shared list of keyboard shortcuts for the help overlay, seeded random numbers, synthetic phantom (with landmarks), `window.__sim` test hook | `src/core/` |
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
1. **Load:** the anatomy zone reads `public/data/manifest.json` and puts the list of regions in the store. When the region picker (C-arm zone) emits `regionRequest`, the anatomy loader reads the region files and puts a `Volume` (+ landmarks) in the store. Tests use the synthetic phantom from `src/core/phantom.ts` instead.
2. **Position:** C-arm controls update the `CArmPose` in the store. `src/core/geometry.ts` turns the pose into a source point, a detector plane and project/unproject functions.
3. **Expose:** a shot (or each continuous-fluoro frame) emits an `exposure` event. The renderer draws a DRR from the volume + pose + needle curve + contrast volume, and keeps it on screen (last image hold). Counters update.
4. **Needle:** needle controls send hand actions (angle, advance, rotate bevel) to the needle model. It computes the new shaft curve using tissue labels from the volume, and stores the `NeedleState`.
5. **Feel & events:** the sim reads the tissue at the tip after each needle step and emits `TissueEvent`s (loss of resistance, bone contact, dural puncture, nerve contact, intravascular…).
6. **Contrast:** an injection makes the contrast module add to a contrast volume according to the compartment at the tip. The renderer adds it on the next image.
7. **Score:** the procedures module watches exposures, needle state and events. On **Finish** it scores the attempt and emits `attemptFinished` with an `AttemptRecord`; the app shell saves it in the browser. A finished quiz session does the same.

The 3D view only reads the store; it never changes it.

## Conventions
- **Coordinates:** patient-based, in millimetres. +x = patient's left, +y = toward the back (posterior), +z = toward the head. Patient prone. The C-arm isocentre is the origin of the table-relative frame.
- **Units:** mm and degrees in all public functions; radians only inside maths code.
- **Determinism:** anything random takes a seed from `src/core/random.ts`.
- **Clinical data files** (`params.json`, `tissues.json`, case files, quiz bank) carry a `status` or `reviewedByOwner` field. Loops write `draft` or `false`; only the owner changes them.
- **UI:** each zone except `core` exports `mount(element)` from its `index.ts` and builds its own panel. Only the app zone edits `src/app/main.ts`. Interactive elements get `data-testid` attributes.
- **Test hook:** `window.__sim` is created in `src/core/testHook.ts` only when `import.meta.env.DEV` or test mode is on (`main.ts` loads it with a dynamic import inside a DEV check, so it is not in the production build). Zones register read-only getters with `registerDebugGetter(name, getter)` from `src/core/debugRegistry.ts`; each appears as `window.__sim.<name>()` and returns a copy. That file does nothing in production and never contains the text `__sim`.
- **Oblique sign:** positive oblique = right: the detector (above the prone patient's back) swings toward the patient's right (−x). At +90° the detector is on the patient's right and the source on the left.
- **Tilt sign:** positive tilt = cranial: the detector tilts toward the patient's head (+z) and the source toward the feet. Negative = caudal.
- **Image orientation:** at pose (0°, 0°) image up = the patient's head and image right = the patient's right (seen from behind the prone patient's back). Pixel (0, 0) is the top-left corner; the image is 512×512. Display flips (F2.7) are applied on top.
- **Table offsets:** `tableLeftRight` along x (+ = toward the patient's left), `tableHeadFoot` along z (+ = toward the head), `tableHeight` along y (+ = up, toward the back). They move the patient relative to the isocentre.
- **Volume layout:** voxel (i, j, k) is stored at index `i + size.x * (j + size.y * k)`; `origin` is the patient position of the centre of voxel (0, 0, 0); `orientation` gives the patient direction of the i, j and k axes. Level names in landmarks and events are text (`'L4'`); numeric level ids exist only in the level volume (`LEVEL_IDS` in `src/core/labels.ts`).
- **Shared instances:** `src/core/store.ts` exports the app's one `store` and `bus`; unit tests make their own with `createStore()` / `createEventBus()`.
- **Procedures:** the procedures zone fills `store.procedures` (`{ id, title }`); the app's procedure picker emits `procedureRequest` (a procedure id) and the procedures zone starts the case. Finished procedures and quiz sessions emit `attemptFinished`; the app shell saves the record.
- **Screen flag:** the app sets `data-screen` on `<html>` to the screen on show (`home`, `sim`, `procedures`, `quiz`, `about`, `history`). Zones with page-wide shortcuts may read it, like the disclaimer flag.
- **Disclaimer flag:** while the disclaimer is shown, `<html>` has `data-disclaimer="shown"` and the rest of the page is inert. Zones with page-wide shortcuts read the attribute instead of importing from `src/app/`.
- **Landmark levels:** a foramen is listed under the level above it (the L4–L5 foramen belongs to L4, whose nerve root exits there). This is how events name a nerve root's level.
- **Zones talk only through `src/core/`:** a zone never imports from another zone's folder (only `src/app/main.ts` imports every zone's `mount`). What one zone needs from another goes through the store, the event bus or another shared file in `src/core/`.
- **Regions:** the anatomy zone fills `store.regions` (`{ name, title }`); the region picker emits `regionRequest` (a region name) and the anatomy zone loads it. Loading does not take an image.
- **Image kind:** the C-arm zone sets `store.lastImageKind` (`'shot'` or `'fluoro'`) together with `lastImagePose`, before emitting `exposure`. The renderer uses more grain for fluoro frames.
- **Shortcut help:** each zone registers its keys as a group in `src/core/shortcuts.ts`; the help overlay (C-arm zone) lists every group.
- **Sacrum and iliac crests:** they are not per-level landmark entries; a region's `Landmarks` has optional `sacrum` and `iliacCrest` fields. The L5–S1 foramen is listed under L5.
- **Image taps:** a click or tap on the fluoro image makes the render zone emit `imageTap` with the pixel of the image as taken (display flips/rotation and magnification undone), so `createProjection(store.lastImagePose).unproject(tap)` is that pixel's ray. The needle zone's Mark entry tool listens to it (F5.2).
- **Bone contact:** `NeedleState.boneContact` (optional; absent = false) is set by the needle zone from its model; the sim zone turns a change to true into a `boneContact` event.
- **Needle direction:** the skin entry is where the beam ray meets the skin on the detector side (the patient's back at pose 0°/0°); the needle points against the beam direction (detector → source). `unproject` rays start at the source, under the table, so walking along them from their start would find the belly.
- **Sim in the needle panel:** `main.ts` mounts the sim zone into the needle panel's slot, after the needle zone, so its feedback (resistance, Aspirate, event log) shows inside the needle panel.
- **Unit tests run without a browser page** (Vitest `node` environment, no jsdom/happy-dom). Logic that needs a unit test lives in plain functions; screens are checked by screen tests.

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
- F1 and F3 meet at the region picker. Each side is built and tested against the shared contract on its own, so they still run in parallel; one end-to-end test (F1-S27) is added after both are merged.
- F5, F6 and F7 meet the same way: F5-S11 (canvas tap → entry, needs F7), F5-S14 (real needle → tissue events and the needle-panel layout, needs F6) and F5-S15 (real needle → image, needs F7) wait until both sides are merged.
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
               (acceptDisclaimer, simPage: getSimState/takeImage/setPose, readCanvas: grey values of the fluoro canvas)
docs/          spec, architecture, decisions, prompts
ralph/         loop prompts, task files, progress logs, loop script
```
