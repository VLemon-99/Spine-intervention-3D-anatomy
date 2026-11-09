# Decision log

> One entry per meaningful choice, newest at the top. This stops future sessions and loop rounds from quietly undoing past decisions. Loop rounds don't edit this file — they record proposals in their progress log, and an interactive session adds them here after review.

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
