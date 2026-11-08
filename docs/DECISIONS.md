# Decision log

> One entry per meaningful choice, newest at the top. This stops future sessions and loop rounds from quietly undoing past decisions. Loop rounds don't edit this file — they record proposals in their progress log, and an interactive session adds them here after review.

## YYYY-MM-DD — [Short title]
- **Decision:** [What was chosen]
- **Why:** [The reason, in plain language]
- **Alternatives considered:** [What else was on the table and why it lost]
- **Revisit if:** [What would make this worth reconsidering]

## YYYY-MM-DD — Build with Ralph loops
- **Decision:** Features are split into small stories in `ralph/tasks/` and built by automated loops (one story per round, fresh context each round), each feature on its own branch, merged only through a reviewed pull request.
- **Why:** Lets work run unattended and in parallel while keeping every change small, tested and reviewable.
- **Alternatives considered:** Fully interactive sessions (slower, needs constant attention).
- **Revisit if:** Loops regularly produce work that fails review — fix the spec and tests first.
