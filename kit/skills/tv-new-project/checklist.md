# Checklist: new project

Work top to bottom. Nothing here is optional.

---

## 1. Scaffold

- [ ] Copy `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter/` and rename the folder.
- [ ] Set `name` and `description` in `package.json`. The description follows the house form:
      `"React with TypeScript | <one line on what this is>"`.
- [ ] Change `<title>` in `index.html`.
- [ ] Pick the accent colour in `scripts/branding.js` and `src/resources/styles/variables/colors/_colorStatics.scss`.
- [ ] `pnpm install`.
- [ ] `pnpm std:check` passes on the untouched template before you write anything.

If the project is not React, use the framework's official scaffolder (`uv init`, `cargo new`,
`rails new`, `dotnet new`), then apply this standard's conventions on top. Never hand-write a
manifest.

---

## 2. Git, before the first commit

- [ ] `git init`, branch named `main`.
- [ ] `.gitignore` reviewed against the actual stack: `node_modules`, `dist`, `.env.local`,
      coverage, OS files, editor files, `storybook-static`.
- [ ] `.env` committed with **names only, no values**.
- [ ] `.env.local` created locally and confirmed ignored.
- [ ] `.husky/pre-commit` present and **tracked**, not ignored. `git config core.hooksPath`
      answers `.husky/_` after `pnpm install`, which is what the `prepare` script sets up.
- [ ] The hook actually fires. Break something on purpose, try to commit, and confirm it is
      refused. A hook nobody has seen refuse anything is a hook nobody knows is broken.
- [ ] First commit is `chore: scaffold project`, and it contains only the scaffold.

---

## 3. Documentation, before the first feature

- [ ] `CLAUDE.md` at the root, in the fixed order: what it is, stack, quick start, architecture
      tree, layer hierarchy, context provider order, key principles, comment style, self-service
      order.
- [ ] `README.md` with what it is, how to run it, how to check it. Nothing aspirational.
- [ ] A line in `CLAUDE.md` saying TV-STANDARD governs it (the rules installed in `~/.claude/rules/tv/`).

Writing `CLAUDE.md` before the first feature is the point. It forces the architecture decisions to
be made deliberately rather than accreted.

---

## 4. Skeleton, before the first feature

- [ ] `src/` has all six top-level folders, even the empty ones: `api`, `commons`, `features`,
      `pages`, `routes`, `resources`.
- [ ] `commons/utils/typeChecks/` present: `isSpecificType`, `isNullOrEmpty`, `equalityChecks`.
- [ ] `commons/constants/shared.ts` present: `EMPTY_ARRAY`, `EMPTY_OBJ`, `emptyOnClick`.
- [ ] `commons/systems/responseObjectSystem/` present.
- [ ] `resources/styles/` caller structure present and injected via `vite.config.ts`.
- [ ] `routes/modules/` has the URL definitions and the route table, even with one route.

The skeleton goes in first, empty. Retrofitting a layer after three features exist is a
refactor; putting it there first is a folder.

---

## 5. The first vertical slice

Build one entity end to end before building two of anything. It is the reference implementation
everything else gets compared to, and it is where the conventions get proven.

- [ ] `api/queries/<entity>/endpointsDefinition.ts`
- [ ] One `create/` operation: `endpointCalls`, `endpointTypes`, `validateRequiredPayloadData`
- [ ] One `lazyFetch/` or `read/` operation
- [ ] `features/<Entity>/Add<Entity>/` with its validations hook
- [ ] `features/<Entity>/Manage<Entity>/` with its columns definition
- [ ] `pages/<Entity>Page/`
- [ ] The route wired into the table
- [ ] Tests on the pure logic in `modules/`

- [ ] Name the reference entity in `CLAUDE.md`: *"when in doubt, read `features/Notes/` first."*

---

## 6. Before calling it set up

- [ ] `pnpm std:check` clean.
- [ ] `pnpm test:unit` green.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm dev` starts and the branded banner prints.
- [ ] Storybook runs. A story is written when a component has variants worth seeing side by
      side (TV 04), not to tick this box.
- [ ] Every dependency checked for advisories, and none released in the last 7 days.
- [ ] `pnpm-lock.yaml` committed.
