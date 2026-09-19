# CLAUDE.md

A React 19 + TypeScript starter that ships the TV-STANDARD conventions already applied. One
neutral demo entity, "Note", is wired through every layer so the shape of each layer is visible
rather than described. Copy it, rename it, point it at a server.

IMPORTANT: TV-STANDARD is the governing standard for this template. Load
`PersonalProjects/TV-STANDARD/AGENTS.md`, `identity/` and `standards/` in full before writing
anything here. Do not sample them, and do not grep for the one rule you think you need.

## Stack

- React 19, TypeScript 5.9 (`strict`), Vite 6
- React Router 7, data router built from a route table
- SCSS, global, no CSS Modules, no Tailwind
- Mantine 7, behind a wrapper, never imported by a feature
- Axios for the one module-level API instance
- Vitest with jsdom, Storybook 9
- ESLint (airbnb + prettier), Prettier, Stylelint

## Quick start

```bash
pnpm install
cp .env .env.local        # then fill in the real values in .env.local
pnpm dev

pnpm std:check            # must be clean before anything is called done
pnpm test:no-watch
pnpm build
```

## Architecture

```
src/
├── api/
│   ├── configs/                          # The machinery. Domain-free.
│   │   ├── controllers/CRUD/             # useCreateController, useReadController, ...
│   │   ├── services/                     # apiServices.ts, the axios instance
│   │   └── modules/handlers/             # action types, payload cleaning, response actions
│   └── queries/notes/                    # The domain: URLs, payloads, validation, endpoint hooks
├── commons/
│   ├── components/                       # Reusable UI. Zero domain knowledge.
│   ├── contexts/                         # Split state/actions contexts, five-file layout
│   ├── systems/responseObjectSystem/     # One vocabulary for "did this work and why not"
│   ├── types/ constants/ utils/          # generic.ts, shared.ts, typeChecks/, formatting/
├── features/Notes/                       # AddNote, ManageNotes
├── pages/NotesPage/                      # Layout orchestration only
├── routes/                               # Route table as data, router generated from it
└── resources/styles/                     # callers/, variables/, mixins/, defaultComponentStyles/
```

## Layer hierarchy

```
Route (auth + permissions)
  -> Page (layout, tabs, detail reads)
    -> Feature (business logic, mutations, validation)
      -> Component (UI, no domain knowledge)
```

Each arrow is one-directional. A component never reaches back up to a feature. A page never
contains a mutation.

The API layer has its own hierarchy, and no layer reaches past its neighbour:

```
endpointCalls (useAddNote)
  -> CRUD controller (useCreateController)
    -> PerformApiService (axios, response routing)
      -> responseDataTypeGuard (validates the shape the server actually sent)
```

## Context provider order

Nested explicitly in `routes/router.tsx`, inside `AppContextLayout`. The order is load-bearing:
it says which context can consume which.

```
Toast -> <Outlet />
```

Add new providers to that chain by hand and update this line in the same commit. There is no
`composeProviders` helper on purpose.

## Key principles

- IMPORTANT: Search before you create. Every utility, hook, type, component, constant. Duplication
  is the only unconditional defect in this standard.
- IMPORTANT: `pnpm std:check` passes before anything is reported as done. Not "passes except for".
- IMPORTANT: Types end in `Type`. A component's props type is `<ComponentName>Type`, never
  `...Props`, never an `I` prefix.
- IMPORTANT: No barrel files, no path aliases. Deep relative imports only, grouped by origin with
  blank lines, sorted longest line first inside each group, the `.scss` import always last.
- IMPORTANT: `isNullOrEmpty(value)`, never `!value`. `areEqual(a, b)` for anything structural.
- IMPORTANT: No `enum`. `as const` objects with the union type derived from them, and a coercion
  function next to the union for anything arriving from a URL, storage or a server.
- IMPORTANT: A hook that returns an object returns it memoised: `return useMemo(() => ({ ... }), [ ... ]);`. A hook returning a single value returns it bare.
- IMPORTANT: A disabled control always carries the reason. The validation hook returns one response
  object per affordance, and the component uses its `status` for `disabled` and its `msg` for the
  tooltip. They come from one place so they cannot drift.
- IMPORTANT: Mantine is touched only by `App.tsx` and by `GenericModalComponent`. A feature that
  imports `@mantine/*` is a bug.
- IMPORTANT: The committed `.env` is a schema with no values. Real values live in `.env.local`.
- Loading, empty and error are props on a shared component, not branches at the call site.
- Class composition is the `classNames` array, base class first, `customClassName` last.
- SCSS: PascalCase block matching the component name, `&__element` / `&--modifier`, properties
  grouped by concern (size, layout, colour, typography, behaviour), no hex literals, no `@import`.
- Tests cover pure modules, not renders. If a rule is hard to test without rendering, the rule is
  in the wrong place and moving it is the fix.

## Demo data

The notes list is local React state in `ManageNotesFeature`, seeded from
`features/Notes/ManageNotes/modules/constants/demoNotesDefinition.ts`, so the template renders a
real page with no backend configured. Nothing fakes a request. When a server exists:

1. Set `VITE_API_BASE_URL` in `.env.local`.
2. Replace the seeded `useState` in `ManageNotesFeature` with `useReadNotes` from
   `api/queries/notes/read/endpointCalls`.
3. Replace the local append in `AddNoteFeature.addNoteHandler` with `useAddNote` from
   `api/queries/notes/create/endpointCalls`.

Then delete `demoNotesDefinition.ts`.

## Comment and writing style

- One line, above the thing, explaining WHY. If the name and signature already say it, no comment.
- No em-dashes anywhere in code-adjacent text. Comments, commit messages, UI strings, PR bodies.
  Use a period, a semicolon, or cut the clause.
- Never rewrite an existing comment for taste. Update it with new information; leave its shape.
- `//-----------` separates the three regions of a component: hooks, handlers, render. One before
  the handler block, one immediately before `return (`.
- No commented-out code, and no `// TODO: handle error`. That is a defect, not a note.

## Where to look before asking

1. The code around the thing you are changing.
2. `PersonalProjects/TV-STANDARD/standards/` and `identity/`.
3. This file and `README.md`.
4. The existing `notes` entity, which is the worked example of every layer.
