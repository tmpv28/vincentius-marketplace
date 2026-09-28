---
name: tv-add-entity
description: Use when adding a new entity end to end to a React + TypeScript project that follows TV-STANDARD (API queries, Add and Manage features, page, route). Mirrors the project's reference entity.
argument-hint: <EntityName> [fields]
---

# Add an entity

One entity end to end, in the shape of the project's reference entity. This is the vertical slice from
the new-project checklist: build it before building two of anything.

## 1. Find and read the reference

- The project's `CLAUDE.md` names the reference entity (in the template: `Notes`).
  If it names none, use the template at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.
- Read, with the Read tool, every file of the reference slice. The Read is what loads the react, typescript,
  accessibility, styles and scss packs; do not skip it or substitute a summary.
  - `src/api/queries/<ref>/endpointsDefinition.ts`, `entityTypes.ts`, `create/*`, `read/*`
  - `src/features/<Ref>/Add<RefSingular>/**` (in the template, `Notes/AddNote`), `src/features/<Ref>/Manage<Ref>/**`
  - `src/pages/<Ref>Page/**`
  - `src/routes/router.tsx`, `src/routes/modules/*`

## 2. Build it, in dependency order

Use the other generators for each part, in this order, so each part lands in the shape its own
generator enforces: `tv-add-api-endpoint` (create, then read), `tv-add-feature` (Add, then Manage),
`tv-add-page`, `tv-add-route`. Ask me for the fields if I did not give them; do not invent a schema.

## 3. Finish

- Extract the pure logic into `modules/` and write its colocated tests (TV 09).
- `pnpm std:check` clean, relevant tests green. Not "passes except for".
- Report the files created, the definitions touched, and anything you could not decide.
