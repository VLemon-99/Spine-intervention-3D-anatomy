# Project: [NAME]

[One or two sentences: what this project is and who it's for.]

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
- Language/framework: [e.g. Python 3.12 + FastAPI]
- Database/storage: [e.g. SQLite]
- Hosting/deployment: [e.g. none yet / Vercel]

## Commands
- Install: `[command]`
- Run locally: `[command]`
- Run all tests: `[command]`
- Lint / type check (if any): `[command]`

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
- [none yet]
