# Starter template — spec-driven, Ralph-loop workflow

You write the spec and approve the results; automated loops do the building in small, tested steps.

## How the workflow runs

1. **Kickoff (you + Claude):** rough idea → interview → `docs/SPEC.md` + `docs/ARCHITECTURE.md`. *Prompt 1.*
2. **Plan:** a fresh session turns the spec into small stories, one task file per feature in `ralph/tasks/`. *Prompt 2.*
3. **Check:** another fresh session critiques the stories before anything runs. *Prompt 3.*
4. **Loop:** each feature runs as a Ralph loop on its own branch — one story per round, tests must pass before each commit, stops when done or at the round limit. Features in different work zones can run in parallel. *Prompt 4.*
5. **Review:** a fresh reviewer checks the pull request (including for tampered tests); you decide whether to merge. *Prompt 5.*
6. **Unblock & wrap up:** answer blocked stories, merge, promote lessons into `CLAUDE.md`. *Prompts 6–7.*
7. **Improve:** between feature cycles, an improvement loop surveys the code, gets each idea independently reviewed, tests, and implements the approved ones. *Prompt 13.*

All prompts are in `docs/PROMPTS.md`.

## Files

| File | Purpose | Who edits it |
|---|---|---|
| `CLAUDE.md` | Rules Claude Code reads automatically every session | Interactive sessions |
| `docs/SPEC.md` | What to build: features + testable acceptance criteria | You + interactive sessions |
| `docs/ARCHITECTURE.md` | Bird's-eye view + work zones for parallel loops | Interactive sessions |
| `docs/DECISIONS.md` | Why things are the way they are | Interactive sessions |
| `docs/PROMPTS.md` | Copy-paste prompts for every step | You |
| `PLAN.md` | Roadmap: features, status, what can run in parallel | Interactive sessions |
| `ralph/PROMPT_plan.md` | Instructions that turn the spec into task files | — |
| `ralph/PROMPT_build.md` | Instructions for each loop round | — |
| `ralph/PROMPT_improve.md` | Improvement loop: suggest → review → test → implement | — |
| `ralph/tasks/*.json` | One file per feature: its stories and their status | Planning + that feature's loop |
| `ralph/progress/*.md` | One append-only log per feature | That feature's loop |
| `ralph/ralph.sh` | Loop script (terminal option) | — |
| `.claude/settings.json` | Guardrails: what agents may and may not run | Kickoff adds your test commands |
| `.gitignore` / `.env.example` | Keep secrets out of git | — |

Each feature has its own task file and progress log, so parallel loops never edit the same file.

## Setting up the template repo on GitHub

1. Upload everything. GitHub's web uploader **skips hidden files and folders** (names starting with a dot). Create these three by hand with **Add file → Create new file**, pasting their contents:
   - `.gitignore`
   - `.env.example`
   - `.claude/settings.json` — typing the `/` in the file name creates the folder
2. Settings → General → tick **Template repository**.
3. In each new project made from it: Settings → Branches → add a **branch protection rule for `main`** requiring a pull request before merging. This is your main safety net — loops can do anything on their own branches, but only you merge.
4. If you'll use the loop script, make it runnable once: ask Claude Code to run `chmod +x ralph/ralph.sh` (or run it as `bash ralph/ralph.sh …`).

## Safety checklist for loops
- Always set a round limit.
- Run unattended loops in cloud sessions or another disposable environment — never with "skip all permissions" on your own computer.
- Test keys and fake data only; no production secrets, no deploy access.
- Only run loops in parallel when their work zones don't overlap.
- Start with one supervised loop on a small feature, then go unattended, then go parallel.
- If loops keep producing poor work, fix the spec and the tests — not the loop.

Replace this README with a real one once the project takes shape.
