---
name: tv-add-feature
description: Use when adding a feature (an Add, Edit, Delete or Manage operation on an entity) to a React + TypeScript project that follows TV-STANDARD. Mirrors the project's reference feature.
argument-hint: <Operation><Entity>, e.g. EditNote
---

# Add a feature

One operation on one entity, end to end, in `src/features/<Entity>/<Operation><Entity>/`.

## 1. Read the reference

Read, with the Read tool, the reference feature of the same kind before writing anything:

- a mutation (`Add`, `Edit`): `src/features/<Ref>/Add<RefSingular>/` (in the template, `Notes/AddNote`); a `Delete`:
  `src/features/<Ref>/Delete<RefSingular>/` (in the template, `Notes/DeleteNote`). Read it in full, including `modules/`
- a list surface (`Manage`): `src/features/<Ref>/Manage<Ref>/` in full, including `modules/constants/`

The reference is the one the project's `CLAUDE.md` names, else the template at
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.

## 2. Write it

- `<Operation><Entity>Feature.tsx` and `.scss` with the same name; `modules/types.ts`, `modules/constants.ts`.
- Mutations get a validation hook in `modules/` returning one response object per affordance; the component uses
  `status` for `disabled` and `msg` for the tooltip.
- The feature owns its endpoint calls. If the endpoint does not exist, run `tv-add-api-endpoint` first.
- Component file anatomy, memoisation, the `classNames` object and the `//-----------` separators exactly as the
  react pack says. Colours, spacing and breakpoints only from the styles tooling.

## 3. Finish

Pure logic extracted to `modules/` with a colocated test. `pnpm std:check` clean. Report the files and
the one thing a reviewer should look at closely.
