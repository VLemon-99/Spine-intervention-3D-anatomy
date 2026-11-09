# Decision log

> One entry per meaningful choice, newest at the top. This stops future sessions and loop rounds from quietly undoing past decisions. Loop rounds don't edit this file — they record proposals in their progress log, and an interactive session adds them here after review.

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
