# Architecture

> The bird's-eye view. Keep this short and current — it's what a fresh agent, loop round or reviewer reads to understand the whole system.

## Overview
[2–3 sentences: how the system works at a high level.]

## Components
| Component | What it does | Where it lives |
|---|---|---|
| [e.g. Web UI] | [Shows the dashboard, handles uploads] | `src/ui/` |
| [e.g. API] | [Validates and stores data] | `src/api/` |
| [e.g. Database] | [Stores users and records] | `src/db/` |

## How data flows
1. [e.g. User uploads a file in the UI]
2. [UI sends it to the API]
3. [API validates it and saves it to the database]

## Work zones (for parallel loops)
Each zone is a set of folders. Two loops can run at the same time only if their features touch **different zones**. Every story in `ralph/tasks/` names its zone.

| Zone | Folders | Notes |
|---|---|---|
| [ui] | `src/ui/`, `tests/ui/` | |
| [api] | `src/api/`, `tests/api/` | |
| [db] | `src/db/`, migrations | Schema changes: never in parallel with anything else |

**Shared files** — changes to these must not happen in parallel loops (do them in F0, or in a single loop, or interactively):
- Dependency files (e.g. `package.json`, `requirements.txt`)
- Shared configuration and database schema
- `CLAUDE.md`, `PLAN.md`, `docs/`

## External services
- [e.g. Stripe for payments — test key in `.env` as `STRIPE_KEY`]

## Folder map
```
src/        application code
tests/      automated tests
docs/       spec, architecture, decisions, prompts
ralph/      loop prompts, task files, progress logs, loop script
```
