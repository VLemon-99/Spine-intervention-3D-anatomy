# Progress log — F8 3D see-through view

> Append-only. Each loop round adds one entry at the bottom. Never rewrite or delete old entries.

## Lessons
<!-- Reusable learnings for future rounds: gotchas, patterns, commands that work. After the feature is merged, an interactive session promotes the useful ones into CLAUDE.md. -->
- `buildSurface` (src/view3d/surface.ts) returns a NON-indexed mesh: 9 floats per triangle in `positions`, same layout in `normals`; triangle count = positions.length / 9. Feed it straight into a Three.js BufferGeometry ('position' and 'normal' attributes, itemSize 3).
- `npm install` is needed first in a fresh cloud session (node_modules is not committed).

## Rounds
<!--
## Round — YYYY-MM-DD HH:MM — F1-S1 — done | failed | blocked
- What I did:
- Files touched:
- Test result:
- Next round should know:
-->

## Round — 2026-11-11 06:50 — F8-S1 — done
- What I did: Added buildSurface(volume, labels): one quad (two CCW triangles) per voxel face between an in-set voxel and an out-of-set voxel or the grid edge, normals out of the set, positions from origin/spacing. Rejects non-identity orientation with a clear error. Unit tests cover the five acceptance criteria plus an empty-set case and winding.
- Files touched: src/view3d/surface.ts, tests/view3d/surface.test.ts, ralph/tasks/F8-view3d.json, ralph/progress/F8-view3d.md
- Test result: verify (6/6) passed; npm run check passed (182 unit, 186 screen passed, 6 skipped). One unit run done while the screen tests ran in parallel had 1 failure that did not repeat; never run `npm test` alongside `npm run check`.
- Next round should know: The phantom bone mesh is built in two passes (count, then fill) and is fast enough for the 95³ phantom; F8-S2 can call it on volume change.
