# Specification (product requirements)

> This is the document the loops build from. Every acceptance criterion must be checkable by an automated test — if it can't be tested, rewrite it until it can. Vague criteria produce confident garbage.

## Goal
[What problem does this solve, and for whom? 2–4 sentences.]

## Users
- [Who uses it and what they're trying to get done]

## How we verify
- Automated tests: [e.g. pytest for logic, Playwright for screens]
- A feature is done when every acceptance criterion below has a passing test.

## Features
Give each feature an ID (F0, F1…) and each criterion an ID (F1.1, F1.2…). Stories in `ralph/tasks/` refer back to these IDs.

### F0 — Walking skeleton
The thinnest version that runs end to end: [e.g. a page that loads, calls the API, reads from the database, and shows one item].

Acceptance criteria:
- [ ] F0.1 [e.g. Running the start command serves a page at localhost]
- [ ] F0.2 [e.g. The page shows one item fetched from the database]
- [ ] F0.3 The test suite runs with one command and passes

### F1 — [Feature name]
[Short description]

Acceptance criteria:
- [ ] F1.1 [e.g. A user can upload a CSV up to 10 MB]
- [ ] F1.2 [e.g. Invalid files show a clear error message and nothing is saved]

### F2 — [Feature name]
[Short description]

Acceptance criteria:
- [ ] F2.1 [...]

## Out of scope (for now)
- [Things deliberately NOT being built — loops must not build these]

## Constraints
- [e.g. Must run on Mac and Windows / Must be free to host / Data must stay local]

## Open questions
- [Unresolved points — planning turns these into questions for me, never into stories]
