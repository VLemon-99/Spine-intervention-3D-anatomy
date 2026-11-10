# Specification (product requirements)

> This is the document the loops build from. Every acceptance criterion must be checkable by an automated test — if it can't be tested, rewrite it until it can. Vague criteria produce confident garbage.

## Goal
Physicians training in fluoroscopy-guided spine injections need many repetitions to learn three skills: recognising what they see on a fluoroscopic image, positioning and angling the C-arm to get the right view, and steering a needle to a target safely. Practising on patients is risky and practising on cadavers is rare and expensive. This app is a free, browser-based simulator. It shows realistic fluoroscopic images of the spine (cervical to sacrum and SI joints) generated from a real anonymised CT scan, lets the learner drive a virtual C-arm (single shots and continuous fluoro), and simulates needle behaviour realistically: angle, pivot at the skin, bevel drift, tip bend and bone contact.

**v1 is done when** a learner can do a lumbar transforaminal epidural injection from start to finish, on a laptop or a touch tablet, and get a score.

## Users
- **Trainees** (residents/fellows in pain medicine, anesthesiology, PM&R, radiology, neurosurgery): practise procedures alone, at their own pace, on a laptop or tablet.
- **The owner** (a physician): reviews all clinical content: procedure rules, target zones, needle "feel", quiz explanations. Clinical content stays marked `draft` until the owner marks it `reviewed`.
- v1 is used by a small group. No accounts. Each learner's history is saved in their own browser.

## How we verify
- **Unit tests (Vitest)** for all logic: geometry, X-ray maths, needle physics, tissue events, contrast, scoring, data files. Location: `tests/<zone>/`.
- **Screen tests (Playwright, Chromium)** in two set-ups that every screen test runs in:
  - `desktop`: 1280×800, mouse + keyboard.
  - `tablet`: 1024×768, touch only (`hasTouch`, `isMobile`).

  Location: `tests/e2e/<zone>/`.
- **Synthetic phantom:** a small, generated, labelled block of "anatomy" (see F0.4). Tests use it instead of the real CT, so they're small, fast and exact.
- **Determinism:** anything random (image noise, random case level/side, aspiration result) takes a seed. The same seed gives the same result.
- **Test hook:** in development and test builds, `window.__sim` exposes read-only state (C-arm pose, needle state, counters, events, last image info) so screen tests can check behaviour without guessing from pixels. It must not exist in the production build.
- **Clinical realism is checked by direction and order, not exact numbers.** Tests check things like "a thinner needle drifts more", not "drifts 2.3 mm". Exact feel is tuned by the owner.
- A feature is done when every acceptance criterion below has a passing test and `npm run check` passes.

## Glossary (plain language)
- **DRR (digitally reconstructed radiograph):** a simulated X-ray image made by sending virtual X-ray beams through a CT scan and adding up how much each one is absorbed.
- **Pose:** the C-arm's position: rotation (oblique), cranial/caudal tilt, and table position.
- **Fulcrum:** the skin entry point that the needle pivots around.
- **Bevel drift:** a bevelled needle tip slides away from the side the bevel faces as it advances.
- **Last image hold:** the screen keeps showing the last image taken until a new one is taken.
- **Label:** the tissue type stored for each tiny cube (voxel) of the 3D anatomy, e.g. bone, muscle, thecal sac.

## Features
Each feature has an ID (F0, F1…) and each criterion has an ID (F1.1, F1.2…). Stories in `ralph/tasks/` refer back to these IDs. Each feature names its work zone (see `docs/ARCHITECTURE.md`).

### F0 — Walking skeleton (zone: all — sets up shared files)
The thinnest version that runs end to end. It sets up the project, the tests and every shared contract, so later features can be built in parallel. The page loads, the disclaimer is accepted, and one fluoroscopic image of the synthetic phantom is rendered on the GPU.

Acceptance criteria:
- [ ] F0.1 `npm install` then `npm run dev` serves the app at `http://localhost:5173`. The page title is "Spine Fluoro Trainer".
- [ ] F0.2 On first load the page shows a disclaimer containing the words "For training only" and "not for clinical use", with an "I understand" button. Until it is clicked, the rest of the app can't be used (screen test: the main panels are hidden or covered).
- [ ] F0.3 After accepting, the main screen shows four panels with test IDs `fluoro-panel`, `carm-panel`, `needle-panel` and `view3d-panel`. Each panel except the fluoro panel may be a placeholder.
- [ ] F0.4 `src/core/phantom.ts` generates the **synthetic phantom**: a small labelled volume (no larger than 128×128×128 voxels) that contains every tissue label in `src/core/labels.ts`. That includes, at minimum, air, skin/fat, muscle, cortical bone, cancellous bone, disc, ligamentum flavum, epidural space, thecal sac, spinal cord, nerve root, artery, vein and joint space. It also contains two vertebra-like blocks with a foramen between them. Unit tests check its size and the label at documented test points. One example of such a check: a straight line from the back of the phantom to the front through the midline crosses skin → muscle → ligamentum flavum → epidural space → thecal sac, in that order.
- [ ] F0.5 `src/core/geometry.ts` turns a C-arm pose into a source position, a detector plane and a pixel grid. It also provides `project(point) → pixel` and `unproject(pixel) → ray`. Unit tests check:
  - the rotation centre (isocentre) always projects to the image centre;
  - projecting then unprojecting returns a ray passing within 0.1 mm of the original point;
  - pose (0°, 0°) is a straight AP beam for a prone patient (source under the table, detector above the back);
  - oblique +90° is a lateral beam.
- [ ] F0.6 Pressing the spacebar or tapping the on-screen **Shot** button (the same button as in F3.3) renders a DRR of the phantom in the fluoro panel. Bone is shown dark and air light. The canvas pixel at the projected centre of the phantom's vertebra block is darker than the pixel in an image corner (air) by at least 50 grey levels out of 255.
- [ ] F0.7 `window.__sim.getState()` returns the C-arm pose, the shot count and the last image's pose in `npm run dev` and in test runs. After `npm run build`, no built file contains the text `__sim`.
- [ ] F0.8 Every work-zone folder in `docs/ARCHITECTURE.md` except `core` (shared contracts, no screen) exists with an `index.ts` that exports a `mount(element)` function (it may render a placeholder) and one passing placeholder test. `src/app/main.ts` mounts all of them.
- [ ] F0.9 `npm run check` runs lint, type check, unit tests and screen tests, in both the desktop and tablet set-ups, and passes.
- [ ] F0.10 `npm run anatomy:convert` exists (run through `tsx`) and points at `tools/anatomy/convert.ts`. In F0 that file is a placeholder: run with no arguments, it prints a usage line containing `<input-folder> <output-folder>` and exits with an error code (unit test). F1 builds the real converter behind it, so F1 never needs to change `package.json`.

### F1 — Anatomy data (zone: anatomy)
Turns a public, anonymised CT scan and its segmentation masks into small files the browser can load. Adds the soft-tissue structures that CT segmentations don't provide, as approximate modelled shapes. Downloading the real CT happens in an interactive session (it needs network access). Loops build and test the converter on small generated test files.

Acceptance criteria:
- [ ] F1.1 `npm run anatomy:convert -- <input-folder> <output-folder>` reads a CT volume and its label masks in NIfTI format. It writes a region file set: a JSON header (size, voxel spacing, orientation, region name) plus gzipped 8-bit intensity and 8-bit label data. A unit test runs it on a tiny generated NIfTI fixture and checks the output matches the expected header and voxel values.
- [ ] F1.2 CT numbers (Hounsfield units) are mapped to 8-bit values over a documented window (default −1000 to +2000 HU). The mapping never decreases (a denser voxel never gets a lower value). Values outside the window are clamped (unit test).
- [ ] F1.3 Dataset labels are mapped to our tissue labels (`src/core/labels.ts`) through a mapping table in `tools/anatomy/label-map.json`. A separate **level** volume records which vertebral level each bone voxel belongs to (C1…C7, T1…T12, L1…L5, sacrum, ilium). Unit test on the fixture: every bone voxel has a level and no non-bone voxel does.
- [ ] F1.4 The soft-tissue modeller adds approximate ligamentum flavum, epidural space, thecal sac (if missing), exiting nerve roots on both sides at each level, segmental/radicular arteries at lumbar levels, and the SI and facet joint spaces. Unit tests on the phantom geometry check that:
  - every foramen has nerve-root voxels on both sides;
  - the midline back-to-front order from F0.4 holds;
  - joint-space voxels lie between two different bones.
- [ ] F1.5 The converter writes `public/data/manifest.json` listing each region (`cervical` C1–T1, `thoracic` T1–L1, `lumbosacral` L1–sacrum including both SI joints) with its files, voxel spacing, source dataset name, licence and attribution text. It also writes a landmarks file per region with, for each vertebral level: the body centre, pedicle centres, the superior and inferior endplates' centres and tilt directions, the superior articular process tips, and the foramen centres (the L5–S1 foramen is listed under L5). Where the region contains them it also holds the sacrum's landmarks (S1 superior endplate centre and tilt direction, S1 superior articular process tips) and the highest point of each iliac crest. C1 and C2 have no entry for now (see Open questions). A unit test validates the manifest and landmark files against their schema, and checks each region's files total 25 MB or less.
- [ ] F1.6 `loadRegion(name)` loads a region in the browser and returns a volume matching the shared `Volume` type. Screen test: choosing a region from the region picker renders it, and `window.__sim` reports the loaded region name and its size.
- [ ] F1.7 (needs real data, done with the owner) The three real regions are converted and committed. Tests: the manifest lists all three, every file exists, and at every landmark "body centre" the label is bone and the level matches the landmark's level.

### F2 — Fluoroscopic image renderer (zone: render)
Turns the volume and the C-arm pose into a realistic flat-panel fluoroscopic image on the GPU. A slower CPU version of the same maths exists as a reference for tests.

Acceptance criteria:
- [ ] F2.1 `renderDrrCpu(volume, pose, options)` computes the image with the standard X-ray absorption law (each ray's brightness = e^(−total absorption along the ray)), using cone-beam geometry from `src/core/geometry.ts`. Unit tests:
  - an empty volume gives every pixel full brightness;
  - for a uniform slab, brightness goes down as thickness goes up;
  - doubling the slab thickness squares the transmitted fraction, within 2%.
- [ ] F2.2 The GPU renderer matches the CPU reference on the phantom at three different poses. The mean absolute pixel difference is 3% of the grey range or less (screen test, reading canvas pixels).
- [ ] F2.3 Default display: more absorption = darker (bone, metal and contrast dark; air light). The "Invert" toggle swaps this. Screen test: the vertebra pixel from F0.6 becomes lighter than the corner pixel after inverting.
- [ ] F2.4 Magnification: settings 1×, 1.5× and 2× scale the projected width of a phantom structure by those factors (±5%). Moving the table (and so the anatomy) closer to the source makes the structure appear larger (unit test on the CPU reference).
- [ ] F2.5 Collimation: four shutters (left, right, top, bottom) are set as a percentage of the field. Pixels outside the open area show a uniform "no signal" fill with zero variation (unit and screen test).
- [ ] F2.6 Noise: X-ray grain with a seed and a level. Same seed = identical image. On a uniform region, pixel spread (standard deviation) rises as the noise level rises. Continuous-fluoro frames use a higher default noise level than single shots (unit test).
- [ ] F2.7 Image orientation: flip left-right, flip up-down and rotate in 90° steps. A unit test checks a known pixel ends up where expected for each option.
- [ ] F2.8 The renderer accepts an optional **extra absorption volume** on the same grid (used later for contrast) and adds it to the absorption along each ray. Unit test: a synthetic extra volume darkens exactly the pixels whose rays cross it.
- [ ] F2.9 The image is 512×512 pixels by default, and the fluoro panel shows the pose of the image on screen as text on the image: the two angles only, not the table position (e.g. "OBL R 25° · CRAN 10°").

### F3 — C-arm, table and exposure (zone: carm)
The controls a learner uses to position the C-arm and take images, with radiation counting.

Acceptance criteria:
- [ ] F3.1 Pose ranges: oblique rotation −90° to +90° (negative = left, positive = right, ±90° = lateral), tilt −40° (caudal) to +40° (cranial), table left/right ±200 mm, head/foot ±400 mm, height ±150 mm. Values outside the range are clamped (unit test). The patient is prone.
- [ ] F3.2 Each pose value has a slider with a number readout. Keyboard shortcuts (listed in a help overlay opened with `?`) step each value: 1° per press, or 5° with Shift; 5 mm for table moves. Screen test in both set-ups: moving a slider (mouse drag on desktop, touch drag on tablet) changes `window.__sim` pose to match the readout.
- [ ] F3.3 Single shot: one press of the spacebar, or one tap of the on-screen **Shot** button, takes exactly one image and adds 1 to the shot count (screen test).
- [ ] F3.4 Continuous fluoro: while the `F` key or the on-screen **Fluoro** pedal button is held, the image updates as the pose changes. Fluoro time increases by the time held, within 10%. On release, updates stop (screen test: the image changes during the hold, but not after release when the pose changes).
- [ ] F3.5 Last image hold: changing the pose without taking an image does not change the displayed image (screen test: the image's pixel fingerprint is unchanged).
- [ ] F3.6 Counters: shot count and fluoro time (seconds, one decimal) are always shown and reset when a new case starts (unit + screen test).
- [ ] F3.7 Region picker: the learner can switch between the anatomy regions the manifest lists. On the phantom-only build, the list shows "Phantom".

### F4 — Needle mechanics (zone: needle)
A physics model of the needle, in plain TypeScript with no screen code, so it is fully unit-testable. All tuning numbers live in `src/needle/params.json` with `"reviewedByOwner": false` until the owner tunes them.

Acceptance criteria:
- [ ] F4.1 `src/needle/catalogue.json` lists at least: 22G and 25G Quincke spinal needles at 3.5" (89 mm) and 5" (127 mm), a 20G Tuohy epidural needle, and one curved-tip RF cannula. Each entry has gauge, length, tip type and stiffness. A unit test validates the schema and checks those six needles exist.
- [ ] F4.2 Fulcrum: the shaft always passes through the skin entry point. Tilting the hub moves the tip to the **opposite** side. The tip-to-hub movement ratio equals inserted length ÷ outside length, within 5% (unit test, straight needle).
- [ ] F4.3 Bevel drift: advancing a Quincke needle 40 mm through uniform muscle moves the tip away from the bevel face. Rotating the bevel 180° moves the drift to the other side (unit test).
- [ ] F4.4 Drift ordering (unit tests, all else equal):
  - 25G drifts more than 22G;
  - stiffer tissue gives more drift than softer tissue;
  - drift grows with depth.
- [ ] F4.5 Spinning the needle while advancing (bevel rotated continuously) gives a straighter path: less than 25% of the no-spin drift at the same depth (unit test).
- [ ] F4.6 Pre-bent tip: with a pre-bend angle set (0–30°), the tip curves toward the bend. A larger bend gives more curve, and rotating the hub turns the direction of the curve (unit test).
- [ ] F4.7 Bone: the tip cannot enter a bone voxel. Advancing into bone stops the tip at the surface and reports `boneContact`. Further advancing does not move the tip deeper (unit test on the phantom).
- [ ] F4.8 Track memory: changing the hub angle while the needle is deep barely moves the path ahead (tip moves less than 1 mm per 5° of hub change at 40 mm depth). After withdrawing to less than 10 mm depth and re-advancing, the new path follows the new angle (unit test).
- [ ] F4.9 The shaft is modelled as a curve from hub to tip whose length stays the same within 1%. The needle cannot be inserted past its own length (the hub stops at the skin) (unit test).
- [ ] F4.10 Same inputs give an identical path, i.e. the model is deterministic (unit test).

### F5 — Needle handling controls (zone: needle)
How the learner holds and steers the needle with a mouse, keyboard or touch.

Acceptance criteria:
- [ ] F5.1 Before insertion the learner picks a needle from the catalogue and a pre-bend angle (0–30°, steps of 5°). After insertion, both are locked until the needle is fully withdrawn (screen test).
- [ ] F5.2 Skin marking: with the **Mark entry** tool, tapping or clicking a point on the current fluoro image places the entry point where that beam ray meets the skin. Screen test on the phantom: `window.__sim` entry point is on the skin label boundary (within 1 voxel) and projects to the tapped pixel (within 2 px).
- [ ] F5.3 The needle starts aligned with the beam that took the current image ("down the beam").
- [ ] F5.4 Desktop controls:
  - dragging on the needle control pad changes the hub angle on two axes (limited to ±45° from the start);
  - the scroll wheel advances/withdraws 1 mm per step, or 0.2 mm with Shift;
  - `W`/`S` advance/withdraw;
  - `Q`/`E` rotate the bevel ±15°;
  - arrow keys change the angle by 1°.

  Screen test: each one changes `window.__sim` needle state as described.
- [ ] F5.5 Tablet controls:
  - one-finger drag on the control pad changes the angle;
  - a two-finger twist rotates the bevel;
  - on-screen **Advance** / **Withdraw** buttons move 1 mm per tap, or continuously while held.

  Screen test in the tablet set-up.
- [ ] F5.6 Readouts: inserted depth (mm), bevel direction (a clock-face indicator matching the notch on a real hub), and the needle's angle relative to the beam (degrees). A **Withdraw fully** button removes the needle (screen test).

### F6 — Tissue feedback and events (zone: sim)
What the needle tip "feels" and what can go wrong.

Acceptance criteria:
- [ ] F6.1 `tipTissue(state)` returns the tissue label at the tip. The needle panel shows a resistance bar. Tissue names are shown in Practice mode only, never in Exam mode (unit + screen test).
- [ ] F6.2 Each tissue has a resistance value in `src/sim/tissues.json`. Crossing from ligamentum flavum into epidural space emits one `lossOfResistance` event (unit test on the phantom midline path).
- [ ] F6.3 Events, each emitted once per entry and stored with time and tip position (unit tests on the phantom):
  - `boneContact`;
  - `duralPuncture` (tip enters the thecal sac);
  - `nerveContact` (tip within 1 mm of a nerve-root voxel; the message names the level and side, e.g. "Paresthesia — left L5");
  - `intravascular` (tip inside an artery or vein voxel);
  - `cordContact` (tip enters the spinal cord).
- [ ] F6.4 **Aspirate** returns "CSF" in the thecal sac and "blood" in a vein. In an artery it returns "blood" only with a seeded probability (default 50%), because negative aspiration doesn't rule out arterial placement. Otherwise it returns "nothing" (unit test with fixed seeds).
- [ ] F6.5 An event log in the needle panel lists this attempt's events, newest first (screen test).

### F7 — Needle in the image (zone: render)
The needle shows up on new fluoroscopic images like real metal.

Acceptance criteria:
- [ ] F7.1 The needle shaft adds strong (metal) absorption along its curve. On a new image, pixels along the projected needle are darker than pixels 5 px to the side (screen test on the phantom, in soft tissue).
- [ ] F7.2 The projected tip pixel matches `geometry.project(tip)` within 2 px for 5 seeded random poses (screen test).
- [ ] F7.3 A needle exactly parallel to the beam ("down the beam") projects to a spot no longer than 4 px. At 30° to the beam it appears as a line longer than 20 px (screen test at a fixed depth).
- [ ] F7.4 The needle only changes on the screen when a new image is taken (last image hold, as in F3.5) (screen test).

### F8 — 3D see-through view (zone: view3d)
A separate 3D view showing the anatomy, needle and C-arm, for learning and debugging. Hidden in Exam mode.

Acceptance criteria:
- [ ] F8.1 The **3D view** toggle shows/hides a 3D scene containing the bone surface (built from the volume), the needle, the C-arm source and detector, and the beam outline (screen test: `window.__sim` reports the scene's object list).
- [ ] F8.2 Scene objects follow the state: after a pose or needle change, the C-arm and needle object positions in the scene match the state within 0.5 mm (screen test).
- [ ] F8.3 Orbit and zoom: mouse drag and wheel on desktop; one-finger drag and pinch on tablet (screen test: camera position changes).
- [ ] F8.4 Layer toggles: nerve roots, vessels, thecal sac and soft tissue can each be shown or hidden (screen test).
- [ ] F8.5 In Exam mode the 3D view is hidden and its toggle is disabled (screen test).

### F9 — Contrast injection (zone: contrast)
Inject contrast and see where it goes, the way real spread patterns confirm needle placement.

Acceptance criteria:
- [ ] F9.1 **Inject** adds contrast in 0.1 mL steps (0.1–5 mL total) when the needle is inserted. It is disabled otherwise (screen test).
- [ ] F9.2 The spread depends on the tissue at the tip (unit tests on the phantom: contrast voxels lie only in the listed labels):
  - **epidural**: spreads along the epidural space up/down and along the nerve-root sleeve;
  - **intrathecal**: spreads widely in the thecal sac;
  - **intra-articular**: fills the joint space;
  - **muscle/soft tissue**: stays as a blob within 15 mm of the tip.
- [ ] F9.3 **Intravascular** contrast follows the vessel and disappears within 2 seconds of simulation time (washout). With continuous fluoro it is seen and then vanishes. A single shot taken after washout shows nothing (unit + screen test).
- [ ] F9.4 More contrast gives more contrast voxels (the count never decreases as volume increases) (unit test).
- [ ] F9.5 Contrast is passed to the renderer as the extra absorption volume (F2.8) and appears dark on new images (screen test). It persists for the rest of the case, except intravascular contrast.
- [ ] F9.6 Each injection is logged as an event with volume and compartment (unit test).

### F10 — Procedures and scoring (zone: procedures)
Guided cases with goals and a score. All clinical rules live in data files drafted from standard practice and marked `"status": "draft"` until the owner reviews them.

Acceptance criteria:
- [ ] F10.1 Procedure files in `src/procedures/cases/` exist for:
  - **lumbar transforaminal ESI, subpedicular ("safe triangle") approach**;
  - **lumbar transforaminal ESI, infraneural (Kambin's triangle) approach**;
  - **lumbar medial branch block**;
  - **SI joint injection**;
  - **caudal ESI**;
  - plus a **phantom demo** case for tests.

  Each file has a name, a status (`draft`/`reviewed`), a region, allowed levels/sides, allowed needles, required views, a target zone, the expected contrast pattern, forbidden events with severity, and reference shot/fluoro-time values. Required views are pose ranges, defined relative to landmarks; for example, "tilt within ±5° of the target level's inferior endplate" gives squared endplates. Target zones are defined relative to landmarks. A unit test validates every file against the schema.
- [ ] F10.2 Case flow: choose a procedure → a seeded random level and side is picked → a short briefing shows the goal → the learner takes views, places the needle and injects → **Finish** → score screen (screen test with the phantom demo case).
- [ ] F10.3 Score from 0 to 100 with these parts:
  - **views obtained**: an image taken within each required view's range;
  - **tip accuracy**: full points inside the target zone, falling to zero at 10 mm away;
  - **contrast pattern** correct;
  - **radiation**: shots and fluoro time compared with reference values;
  - **safety**.

  Any forbidden event marked `critical` flags the attempt as **unsafe** whatever the points. Unit tests with scripted attempts:
  - a perfect attempt scores ≥ 90;
  - the same attempt plus a dural puncture is flagged unsafe;
  - more shots never raises the radiation part;
  - a tip farther from the target never raises the accuracy part.
- [ ] F10.4 Practice mode can show an outline of the target zone on the fluoro image and the tissue name at the tip. Exam mode hides both, and hides the 3D view (screen test).
- [ ] F10.5 Each finished attempt produces an attempt record (procedure, mode, date, score parts, unsafe flag, shots, fluoro time) in the shared format, for the history (unit test).

### F11 — Image-recognition quiz (zone: quiz)
Short quizzes on reading fluoroscopic images of the whole spine.

Acceptance criteria:
- [ ] F11.1 `src/quiz/bank.json` holds at least 40 questions, with at least 8 each for cervical, thoracic, lumbar and sacrum/SI. Each has a region, pose, a highlighted structure (label + level + side) or a "name this view" prompt, 4 choices, the correct answer, an explanation and `"status": "draft"`. A unit test validates the schema and counts.
- [ ] F11.2 A question shows the DRR at the question's pose with an arrow at the structure's centre. The arrow tip is within 3 px of `geometry.project(structure centre)` (screen test).
- [ ] F11.3 Picking an answer shows correct/incorrect and the explanation (screen test).
- [ ] F11.4 A quiz session is 10 questions chosen with a seed and ends with a score saved as an attempt record (unit + screen test).

### F12 — App shell (zone: app)
Home screen, modes, layout for laptop and tablet, history and About page.

Acceptance criteria:
- [ ] F12.1 After the disclaimer is accepted once, it isn't shown again on reload (saved in the browser). The **About** page always shows the disclaimer, the dataset attribution from the manifest, and the app version (screen test).
- [ ] F12.2 Home screen choices: **Practice** (pick a procedure), **Exam** (pick a procedure), **Quiz**, **Free play** (any region, C-arm + needle, no scoring) (screen test).
- [ ] F12.3 Layout (screen test):
  - at 1280×800 and 1024×768 landscape, all four panels are visible without scrolling the page;
  - at 768×1024 portrait, panels stack with the fluoro panel first;
  - in the tablet set-up every button and toggle is at least 44×44 px, and every slider's touch area (the box of the slider control) is at least 44 px wide and 44 px tall. (A browser test cannot measure the handle of a standard slider, so the touch area is checked instead. Each zone's own screen tests check its own panel.)
- [ ] F12.4 History lists finished attempts newest first and survives a reload. **Clear history** asks for confirmation. If browser storage is unavailable, the app still works and shows "History can't be saved in this browser" (screen test, with storage blocked).
- [ ] F12.5 If the browser has no WebGL2, the app shows "This browser can't run the simulator (WebGL2 needed)" instead of a blank screen (screen test, with WebGL2 stubbed out).

## Out of scope (for now)
Loops must not build these.
- Logins, accounts and server-side history (planned for a later version)
- Instructor mode: building cases, watching or reviewing a learner
- Digital subtraction angiography (DSA) — planned bonus after v1
- Cervical and thoracic **procedures** (cervical/thoracic anatomy is in v1 for the quiz and free play only), discography, vertebroplasty, stellate ganglion, RF ablation lesioning
- Several patients or variants (scoliosis, high BMI, hardware/fusion, degeneration)
- Supine or lateral patient positioning (prone only)
- Ultrasound, haptic devices, VR/AR
- Languages other than English
- Any clinical use, or any use with real patient images
- Copying images or text from textbooks into the app (they are reference only)
- Real or institutional patient data; anything other than the chosen public, anonymised dataset
- Deployment/hosting setup (done later, by the owner)

## Constraints
- Runs in a web browser: current Chrome, Edge, Safari on iPadOS 17+, Chrome on Android tablets. WebGL2 is required.
- Laptop (mouse + keyboard) **and** touch tablet (touch only) must both be fully usable.
- Static website only: no server, no database, $0 hosting. The app sends nothing over the network except loading its own files.
- Download size: 25 MB or less per anatomy region, 100 MB or less in total.
- Anatomy comes only from a public, anonymised CT dataset whose licence allows this use (CC BY 4.0 or similar), credited on the About page.
- Clinical content (procedure rules, needle tuning, quiz explanations, soft-tissue shapes) stays `draft` until the owner reviews it.
- Performance target (checked by hand, as cloud tests use a software GPU): continuous fluoro at 15 frames per second or more at 512×512 on a 2021-or-newer iPad and a mid-range laptop.

## Open questions
- **App name:** "Spine Fluoro Trainer" is a working title. Rename any time.
- **Which CT scan(s):** before F1.7 I'll shortlist candidate scans from the TotalSegmentator dataset (CC BY 4.0), with VerSe as a fallback, and the owner picks. (Answered: the regions may come from different anonymous people.)
- **Owner review sessions** are needed for: needle tuning (`src/needle/params.json`), tissue resistances, procedure rule files, quiz explanations, and the modelled soft-tissue shapes.
- **Landmarks for C1 and C2:** they have no normal vertebral body, so F1 leaves them out. Decide before the quiz (F11) needs them. The sacral hiatus and SI-joint landmarks are still to be added for the caudal and SI-joint procedures (F10).
- **Real-tablet performance:** to be checked by the owner on an actual iPad once F2 and F3 are merged.
