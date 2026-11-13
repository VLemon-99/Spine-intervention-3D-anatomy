# Decision log

> One entry per meaningful choice, newest at the top. This stops future sessions and loop rounds from quietly undoing past decisions. Loop rounds don't edit this file — they record proposals in their progress log, and an interactive session adds them here after review.

## 2026-11-13 — F5–F7 planning choices and shared-contract additions
- **Decision (owner accepted every planning default):**
  - **Shared contract (`src/core/`) extended:** an optional `boneContact` field on `NeedleState` (the needle zone fills it, F5-S10; the sim zone turns it into the `boneContact` event, F6-S6), and a bus event `imageTap` whose payload (`ImageTap { x, y }`) is the tapped pixel of the image **as taken** — the render zone undoes display flips/rotation and magnification (F7-S7), so `createProjection(store.lastImagePose).unproject(tap)` is the ray that made that pixel; the needle zone's Mark entry tool uses it (F5-S4).
  - **The sim zone's feedback sits in the needle panel:** `src/app/main.ts` mounts the sim zone into the needle panel's slot (after the needle zone) instead of the hidden slot, so the resistance bar, Aspirate and the event log appear where F6 says.
  - **Tissue name at the tip:** shown in Practice and Free play, hidden in Exam (the spec said "Practice mode only").
  - **Angle to the beam (F5.6):** measured against the current C-arm pose's beam through the entry point, not the pose of the image on screen.
  - **Needle in the image:** one tube width for every needle (0.35 mm radius, draft), because the renderer cannot read the needle catalogue.
  - **The needle is removed** when a new case starts and when another region is loaded.
  - **Draft handling numbers:** control-pad drag 0.2° per pixel; Advance/Withdraw held longer than 300 ms move at 5 mm/s; W/S 1 mm per press (0.2 mm with Shift); the mouse wheel steers only over the needle pad (the 3D view uses the wheel to zoom).
  - **Simulation time** for tissue events: seconds since the last case start.
  - **Event log:** lists every event, including "Intravascular", in every mode (as the spec says).
- **Why:** Asked during F5–F7 planning (2026-11-12). The two contract additions let the needle, sim and render zones loop in parallel without importing each other; mounting the sim in the needle slot is the smallest change that puts its feedback where the spec asks.
- **Alternatives considered:** the sim zone guessing bone contact from the tip position; the needle zone listening to the fluoro canvas itself (it would need the render zone's display settings); the needle panel offering an empty element for the sim zone to find; names in Practice only; a width per gauge (needs the gauge in `NeedleState`).
- **Revisit if:** F9 needs the same clock as F6 (then a shared clock in `src/core/`); learners find the Intravascular message gives the answer away (hide it in Exam); thicker needles should look thicker; the needle panel gets too crowded on the tablet (F12 layout review).

## 2026-11-12 — F3 owner answers: region picker, start region, C-arm keys and labels
- **Decision:**
  - **'Phantom' leaves the region picker once real regions exist.** The picker lists `store.regions` and adds the loaded region only when it is not among them, so 'Phantom' appears only while the synthetic phantom is the loaded volume (today's build, and screen tests). With real regions loaded, it is not offered.
  - **The lumbar region (`lumbosacral`) loads at start** once real regions exist. This is for the anatomy loader (F1) and the app shell (F12), not the C-arm zone.
  - **C-arm keys accepted as planned:** J / L oblique, I / K tilt, N / M table left/right, U / O head/foot, Y / H height; 1° per press, 5° with Shift, 5 mm for table moves.
  - **Table slider end labels accepted for now:** left/right reads R … L (+ = toward the patient's left), head/foot FOOT … HEAD, height DOWN … UP.
  - **F key and Fluoro pedal held together:** releasing either one stops fluoro (safe default).
- **Why:** The owner answered the open questions from the F3 loop (2026-11-12).
- **Alternatives considered:** Keeping 'Phantom' as a permanent test entry; starting on the cervical region; tracking each fluoro source separately.
- **Revisit if:** Learners find the table labels confusing (F12 layout review), or another start region is wanted per procedure.

## 2026-11-11 — F12-S3 may update rememberDisclaimer.spec.ts
- **Decision:** F12-S3 (home screen) may update `tests/e2e/app/rememberDisclaimer.spec.ts` so its tests choose Free play before checking the panels or taking a Shot (or check the home screen after the reload). Its disclaimer checks stay the same.
- **Why:** That test was written in F12-S1, before the home screen existed, and assumed the panels come straight after the disclaimer. With the home screen (F12.2) they no longer do; the test's purpose (the disclaimer is remembered, and the app works with storage blocked) is unchanged.
- **Alternatives considered:** Skipping the home screen when the disclaimer was remembered (goes against the home-screen decision above).
- **Revisit if:** —

## 2026-11-11 — F4, F8 and F12 planning choices
- **Decision (owner accepted every planning default):**
  - **Needle lever rule vs track memory:** the F4.2 lever rule (tip moves opposite the hub by inserted ÷ outside length) applies while the needle is 10 mm deep or less; deeper, track memory (F4.8) holds the inserted part in its track.
  - **Needle clock face:** 12 o'clock = toward the patient's head (made perpendicular to the needle); for a needle going straight into the back, 3 o'clock is the patient's right. The hub notch marks the bevel opening; the tip drifts to the opposite side.
  - **Pre-bend direction:** the bend points away from the hub notch (the side the bevel drift goes, so both add up). The curved RF cannula's curve is built in (from the catalogue).
  - **3D view:** off when the app starts; nerve roots, vessels and thecal sac shown, soft tissue hidden. "Soft tissue" = skin/fat, muscle, disc, ligamentum flavum, epidural space, joint space; the thecal sac layer includes the spinal cord. The C-arm in the 3D view follows the live pose. After Exam mode the view stays off until turned on.
  - **Home screen:** the app opens on the home screen after the disclaimer. History and About are reached from the home screen; the other screens have a Home button. The mode is set when a choice is made on the home screen.
  - **Shared test helper:** F12 may change `tests/fixtures/acceptDisclaimer.ts` so it skips a disclaimer that is not shown (remembered) and then chooses Free play, so every existing screen test still lands on the four panels. Its name and use stay the same.
  - **Screen flag:** the app sets `data-screen` on `<html>` (`home`, `sim`, `procedures`, `quiz`, `about`, `history`). Teaching page-wide shortcuts to ignore keys off the simulator screen is a later change in those zones.
  - **Shared contract (`src/core/`) extended:** `store.procedures` (`{ id, title }`, filled by the procedures zone), bus event `procedureRequest` (a procedure id; the procedures zone starts the case), bus event `attemptFinished` (an `AttemptRecord`, emitted by procedures and quiz, saved by the app shell). F12-S10 and F12-S11 are unblocked.
  - **About page:** the app reads the dataset credits from `data/manifest.json` itself (fields `sourceDataset`, `licence`, `attribution` per region, as F1 writes them). Without a real dataset it shows "Images are computed from a synthetic test phantom; no patient data is used."
  - **No WebGL2:** only the message is shown, without the disclaimer.
- **Why:** Asked during F4, F8 and F12 planning; the owner accepted the recommended options. The spec's F4.2 and F4.8 disagree for deep needles; the bend rule matches common practice; a closed 3D view saves tablet graphics memory; a home screen is what learners expect, and changing the shared helper keeps every existing screen test valid without touching a test file; the shared contract lets the app, procedures and quiz work without importing each other.
- **Alternatives considered:** Lever rule at every depth; bend toward the notch; 3D view on at start; opening straight into Free play with a Home button (no helper change); keeping attempt hand-over undecided until F10.
- **Revisit if:** The needle feels wrong to the owner at the 10 mm switch-over; learners want the 3D view open by default; F10 or F11 need more from the procedure contract (e.g. descriptions or regions in the picker).

## 2026-11-10 — F1–F3 story review: shared-contract additions and story fixes
- **Decision:**
  - **Shared contract (`src/core/`) extended before the loops start:** `store.lastImageKind` (`'shot'` / `'fluoro'`), `store.regions` plus the bus event `regionRequest`, optional `Landmarks.sacrum` and `Landmarks.iliacCrest`, and a shared shortcut list (`src/core/shortcuts.ts`) that the help overlay shows.
  - **Sacrum and iliac crests get landmarks** (S1 superior endplate, S1 superior articular process tips, top of each iliac crest), and **the L5–S1 foramen is found and listed under L5**. The lumbosacral region is cut wide enough to include both iliac crests. C1/C2 landmarks, the sacral hiatus and SI-joint points stay open.
  - **"44 px" for sliders means the slider's touch area**, and each zone tests its own panel.
  - **Pose text shows the two angles only**, not the table position.
  - **Render-zone image tests may keep `setPose`** for exact poses after F3's controls exist.
  - **Fluoro frames use more grain** by scaling the noise setting with the ratio of the two default levels.
  - **Story IDs stay stable:** new stories from splits get new numbers at the end (F1-S23…S27, F3-S11) and only the priority order changes.
- **Why:** The review found that the real lumbosacral region would have had no L5 nerve root (L5–S1 is a very common injection level), that three stories were blocked on one small shared change, that four stories were too big for one loop round, and that a browser test cannot measure a standard slider's handle. The owner approved all nine fixes and asked for sacrum and iliac crest landmarks.
- **Alternatives considered:** Leaving the three stories blocked until after the loops; an "integration" task file; custom-built sliders with a measurable handle; renumbering all stories.
- **Revisit if:** The lumbosacral region with both crests does not fit in 25 MB at 1 mm; F10 needs more pelvic landmarks; F5's keys do not fit the shortcut list's shape.

## 2026-11-10 — F1–F3 planning choices
- **Decision:**
  - **Display controls live in the fluoro panel (F2):** besides the Invert toggle the spec names, F2 adds magnification buttons (1×, 1.5×, 2×), four collimation sliders, and flip/rotate buttons.
  - **Invert, flip and rotate act immediately** on the held image, with no new exposure and no change to the shot count. Magnification, collimation and noise belong to taking the image and apply from the next image. The renderer therefore keeps the image as taken and re-displays it.
  - **The pose text on the image (F2.9) shows the pose the image on screen was taken with**, not the live C-arm pose.
  - **One standard file layout:** the F1 converter always writes region files in the layout the phantom uses (voxel axes along patient left, back, head). The renderer and every other zone assume it and reject anything else.
- **Why:** Asked during F1–F3 planning; the owner had no preference, so the recommended options were adopted. Learners can use everything the renderer can do; a learner should not have to spend a shot (radiation score) just to invert or flip the picture; text on a frozen image should describe that image; and standardising once in the converter keeps the needle, tissue, contrast and 3D-view code simple.
- **Alternatives considered:** Invert as the only control; display changes from the next image; live pose text; every zone handling any stored layout.
- **Revisit if:** The fluoro panel gets too crowded on tablets (F12.3), or a dataset cannot be brought into the standard layout (e.g. a strongly tilted scan).

## 2026-11-10 — F0 merge: image orientation, C-arm numbers, disclaimer wording
- **Decision:**
  - **Image orientation:** at pose (0°, 0°) the image shows the patient's head at the top and the patient's right on the right of the screen, as seen from behind the prone patient's back (from the detector side). Both directions turn with the C-arm. Display flips and rotations (F2.7) are applied on top of this default.
  - **C-arm numbers** (typical mobile C-arm, in `src/core/geometry.ts`): source-to-detector 1000 mm, source-to-isocentre 650 mm, 300 mm square detector, 512×512 image (about a 195 mm field at the isocentre). Table offsets: left/right along x (+ = toward the patient's left), head/foot along z (+ = toward the head), height along y (+ = up, toward the back).
  - **Disclaimer wording** (`src/app/disclaimer.ts`): "For training only — not for clinical use. This simulator approximates fluoroscopic images and needle behaviour for practice. Never use it to plan or guide treatment of a real patient."
- **Why:** Proposed by the F0 loop and approved by the owner on 2026-11-10 after seeing the first image. The orientation matches looking at the patient's back; the numbers are the typical values chosen at F0 planning; the wording states the training-only limit plainly.
- **Alternatives considered:** Patient's right on the screen's left (viewing from the front); matching one specific C-arm model.
- **Revisit if:** Learners expect a different default monitor orientation, a specific C-arm model should be matched, or the About page (F12) needs longer legal text.

## 2026-11-09 — F0 story review fixes
- **Decision:**
  - **Oblique sign:** positive oblique = right. The detector (above the prone patient's back) swings toward the patient's right side; at +90° the detector is on the patient's right and the source on the left.
  - **Tilt sign:** positive tilt = cranial. The detector tilts toward the patient's head and the source toward the feet; negative = caudal.
  - **Shared contracts grow now, in F0:** `src/core/` gains a `Landmarks` type (foramina listed under the level above), a `Mode` type, an `AttemptRecord` that also fits quiz attempts, and store slots for fluoro time, mode, landmarks, needle state and contrast volume, plus `caseStart` and `tissueEvent` bus events. The phantom exports landmarks in the same format as the real regions.
  - **No browser stand-in for unit tests:** no jsdom or happy-dom. Logic that needs unit tests is kept in plain functions; screens are checked by Playwright screen tests.
  - The phantom and the GPU X-ray image stories are each split in two (F0 now has 15 stories).
- **Why:** After F0, `src/core/` can only change in an interactive session, so anything that later features pass between zones has to exist up front, or parallel loops get blocked. Keeping logic browser-free avoids a new dependency. The splits make the two riskiest stories small enough for one round.
- **Alternatives considered:** Adding shared fields feature by feature (blocks parallel loops); adding happy-dom (new dependency); keeping the large stories whole.
- **Revisit if:** A later feature needs another cross-zone field (that is an interactive change to `src/core/`), or browser-free unit tests become awkward.

## 2026-11-09 — F0 planning answers
- **Decision:**
  - F0 adds the `npm run anatomy:convert` command now (with `tsx`, a small dev tool that runs TypeScript files in Node) and a placeholder converter. F1 fills in the converter.
  - The on-screen button that takes an image is called **Shot** everywhere (F0.6 and F3.3 are the same button).
  - `core` has no `mount()` function: it holds shared contracts and has no screen.
  - The C-arm geometry uses typical mobile C-arm distances and detector size, not a specific machine.
- **Why:** Adding the command in F0 keeps `package.json` (a shared file) out of F1, so F1 can run in parallel with other features. One name for one button avoids two buttons doing the same thing. A do-nothing `mount()` in core would be clutter. Typical values are good enough for training, and they're named settings that are easy to change later.
- **Alternatives considered:** F1 adds the command (would block parallel loops); keeping "Take image" as the name; a placeholder `mount()` in core; matching one specific C-arm model.
- **Revisit if:** A specific C-arm model should be matched, or `tsx` causes problems (Node's built-in TypeScript support could replace it).

## 2026-11-09 — Owner answers to kickoff open questions
- **Decision:**
  - The cervical, thoracic and lumbosacral regions may come from **different anonymous people**.
  - Lumbar TFESI is offered with **both** approaches in v1: subpedicular ("safe triangle") and infraneural (Kambin's triangle). Each approach is a separate procedure file.
  - When the needle is in an artery, aspiration returns blood with a **50%** probability, to teach that negative aspiration doesn't rule out intra-arterial placement.
- **Why:** Whole-spine CTs that include the SI joints are rare, and each region is viewed on its own anyway. Both TFESI approaches are in current practice and worth training. 50% makes the teaching point clearly.
- **Alternatives considered:** One person's whole-spine CT (hard to find, lower quality); safe triangle only; always-positive arterial aspiration (teaches a false sense of safety).
- **Revisit if:** A good whole-spine CT becomes available, or the owner wants a different teaching emphasis.

## 2026-11-09 — Pin Playwright to the cloud's pre-installed version
- **Decision:** `@playwright/test` is pinned to **1.63.0**, and loops never run `playwright install`.
- **Why:** Cloud sessions come with Chromium for Playwright 1.63.0 already installed. A different version would try to download its own browser, which is slow or blocked.
- **Alternatives considered:** Always the latest version (breaks in the cloud); installing browsers in every session (slow, needs network).
- **Revisit if:** The cloud image updates its Playwright version. Then bump the pin to match.

## 2026-11-09 — Clinical content is drafted by Claude and reviewed by the owner
- **Decision:** Procedure rules, target zones, needle tuning numbers, tissue resistances, quiz explanations and modelled soft-tissue shapes are drafted from standard practice. They are stored as data files marked `draft` / `reviewedByOwner: false`, and only the owner marks them reviewed. Textbooks are used as reference only. No images or text are copied from them.
- **Why:** The owner is the clinical expert. Copying textbook content would break copyright. Keeping rules as data (not code) makes them easy to review and correct without touching the program.
- **Alternatives considered:** The owner writes all rules up front (slower start); copying textbook figures (copyright problem).
- **Revisit if:** A co-author or institution provides licensed content.

## 2026-11-09 — Desktop and touch tablet are both first-class
- **Decision:** Every control works with a mouse + keyboard **and** with touch only. Every screen test runs twice: in a 1280×800 desktop set-up and a 1024×768 touch tablet set-up.
- **Why:** The owner asked for tablet support. Testing both from the start is much cheaper than retrofitting touch later.
- **Alternatives considered:** Desktop only for v1 (the owner declined).
- **Revisit if:** Phones are wanted (needs a different layout).

## 2026-11-09 — Browser-only, no login in v1
- **Decision:** No server, no accounts. Scores are saved in the learner's own browser (local storage). The site can be hosted for free as static files.
- **Why:** A small group of users for now; $0 cost; nothing to secure or maintain; no personal data collected.
- **Alternatives considered:** Accounts + database now (costs money, adds security work and privacy obligations before the core simulator even exists).
- **Revisit if:** Learners need history across devices or an instructor needs to see results. The owner wants this eventually; it will be a separate feature with its own decision.

## 2026-11-09 — Anatomy from a public anonymised CT, rendered as a DRR; synthetic phantom for tests
- **Decision:** Fluoroscopic images are computed from a real CT scan (a DRR). The scan comes from a public, anonymised research dataset with a permissive licence: TotalSegmentator (CC BY 4.0), with VerSe as a fallback. It is converted offline into small 8-bit volumes per region (cervical, thoracic, lumbosacral incl. SI) with tissue labels and vertebral levels. Soft tissue the CT can't show (nerve roots, ligamentum flavum, small arteries) is added as modelled shapes. All automated tests use a small generated "phantom" instead of the real scan.
- **Why:** Real fluoro is an X-ray shadow of real anatomy, and only a real CT reproduces that look (bone texture, overlapping structures, oblique views). Public anonymised data avoids patient-privacy issues. The phantom keeps tests tiny, fast and exact.
- **Alternatives considered:** Hand-built 3D bone models (look nothing like real fluoro); institutional CT (privacy approvals needed, and the owner chose not to); 16-bit volumes (too heavy for tablets).
- **Revisit if:** Several patients or pathologies are wanted, or a licensed whole-spine CT becomes available.

## 2026-11-09 — Tech stack: TypeScript + Vite + Three.js, Vitest + Playwright
- **Decision:**
  - **TypeScript**: JavaScript with type checking.
  - **Vite**: builds and serves the site.
  - **Three.js on WebGL2**: 3D graphics and our own X-ray shader.
  - **Vitest**: unit tests.
  - **Playwright** (Chromium): screen tests.
  - **ESLint + `tsc`**: code-quality and type checks.
  - Everything runs in the browser and is hosted as a free static site.
- **Why (plain language):**
  - The simulator has to work on laptops *and* tablets with nothing to install, and the browser is the one platform that does both.
  - WebGL2 lets the tablet's or laptop's graphics chip compute X-ray images fast enough for live fluoro.
  - Three.js is the most widely used, best-documented 3D library for the web, so it is quick for loops to work with.
  - TypeScript catches many mistakes before the code runs, which matters when automated loops write the code.
  - Vitest and Playwright are the standard test tools for this setup, and Playwright's browser is already installed in cloud sessions.
  - One language for everything (including the data converter) keeps it simple.
- **Alternatives considered:**
  - A game engine such as Unity or Godot exported to the web: big downloads, harder to test automatically, and harder for loops to edit.
  - Python + a server: costs money to host, adds a second language, and is slower to respond.
  - A native iPad app: excludes laptops and needs app-store work.
  - React: not needed yet; the screens are few and mostly a canvas.
- **Revisit if:** Live fluoro is too slow on target tablets even after optimisation, or the UI grows large enough that a UI framework would clearly help.

## 2026-11-09 — Build with Ralph loops
- **Decision:** Features are split into small stories in `ralph/tasks/` and built by automated loops (one story per round, fresh context each round), each feature on its own branch, merged only through a reviewed pull request.
- **Why:** Lets work run unattended and in parallel while keeping every change small, tested and reviewable.
- **Alternatives considered:** Fully interactive sessions (slower, needs constant attention).
- **Revisit if:** Loops regularly produce work that fails review — fix the spec and tests first.

## 2026-11-11 — F8 start camera shows the whole C-arm
- **Decision:** The 3D view's start camera is far enough back to show the whole C-arm (source to detector). The F8-S2 screen test that required the start camera to be less than 50 mm from a small test volume is changed to require more than 650 mm. The F8-S3 loop round makes that change in the same commit as the camera change.
- **Why:** F8-S3 asks for the whole C-arm in the start view (the source is 650 mm from the isocentre). The F8-S2 loop had added the 50 mm limit as an extra check beyond its acceptance criteria, so the two contradicted each other and the loop blocked F8-S3.
- **Alternatives considered:** Dropping the "whole C-arm" camera requirement from F8-S3 (the learner would have to zoom out to find the C-arm).
- **Revisit if:** The C-arm looks too small on the tablet and learners prefer a close-up start view.
