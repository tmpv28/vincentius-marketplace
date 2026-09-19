# 01 — Project anatomy

## The tree

```
src/
├── api/              # Everything that talks to a server. Nothing else.
├── commons/          # Shared across features: components, hooks, utils, types, constants, systems, contexts
├── features/         # Business logic. One folder per entity, one folder per operation.
├── pages/            # Route-level layout orchestration only.
├── routes/           # Router config, guards, URL definitions.
└── resources/        # Global styles, fonts, icons, static assets.
```

That is the whole top level. It does not grow. If something does not fit one of these six, the
question is which of the six it actually belongs to, not whether to add a seventh.

---

## The layer hierarchy

```
Route (auth + permissions)
  -> Page (layout, tabs, detail reads)
    -> Feature (business logic, mutations, validation)
      -> Component (UI, no domain knowledge)
```

Each arrow is one-directional. A component never reaches back up to a feature. A page never
contains a mutation.

| Layer | Owns | Never contains |
| --- | --- | --- |
| Route | Guarding, redirects, URL shape | Layout, data |
| Page | Composition, tabs, layout, detail-read calls | Mutations, validation, business rules |
| Feature | One operation on one entity, end to end | Layout decisions for the whole page |
| Component | Presentation and interaction | Anything domain-specific |

**The rule that keeps this honest:** a page orchestrates features; it does not do their work. If
a page is calling a mutation, the mutation belongs in a feature that the page renders.

---

## The `modules/` convention

Every unit that needs internals gets a `modules/` folder next to its entry file. Not `helpers/`,
not `lib/`, not `utils/`, not `internal/`. `modules/`.

```
AddNote/
├── AddNoteFeature.tsx          # The entry point. Folder name + layer suffix.
├── AddNoteFeature.scss         # Its styles. Same name as the entry file.
└── modules/
    ├── addNoteValidations.ts   # Its validation hook
    ├── constants.ts            # Its constants
    └── types.ts                # Its types
```

Rules:

- **The entry file is `<FolderName><LayerSuffix>`**, and the `.scss` matches it exactly. The
  folder carries the concept, the file carries the layer: `AddNote/AddNoteFeature.tsx`,
  `NotesPage/NotesPage.tsx`, `ButtonComponent/ButtonComponent.tsx`. Where the layer suffix is
  already in the concept name, folder and file end up identical; that is a coincidence of the
  naming, not the rule.
- `index.ts` barrels are not used for units. You should be able to tell what a file is from the
  tab title alone, which is the whole reason the suffix is on the file rather than the folder.
- **Pages are the exception.** Route components sit flat, several to a folder
  (`pages/NotesPage.tsx`, `pages/NoteDetailsPage.tsx`), because a page rarely has internals worth
  a folder and the sibling routes read better as a list than as a tree. A page that grows a
  `modules/` gets its own folder like anything else.
- `modules/` holds only things used by that unit. The moment a second unit needs it, it moves up
  to the nearest shared level, and it moves properly, not by importing across siblings.
- `modules/types.ts`, `modules/constants.ts`, `modules/utils.ts` are the standard three. Anything
  more specific gets its own descriptively-named file.
- When a module file grows past comfortable reading, it becomes a folder with its own `modules/`.
  The shape is recursive on purpose.

---

## Features

One folder per entity. Inside it, one folder per operation.

```
features/
└── Notes/
    ├── AddNote/
    │   ├── AddNoteFeature.tsx
    │   ├── AddNoteFeature.scss
    │   └── modules/
    ├── EditNote/
    ├── DeleteNote/
    └── ManageNotes/
        ├── ManageNotesFeature.tsx
        ├── ManageNotesFeature.scss
        └── modules/
            └── constants/
                ├── columnsDefinition.tsx
                └── defaultFiltersDefinition.ts
```

`Manage<Entity>` is always the list/table/search surface. `Add`, `Edit`, `Delete` are always the
mutations. This naming is fixed so that finding the delete flow for anything is zero-thought.

A feature owns its endpoint calls. The exception is a detail page's read, which lives at page
level because the page is what the URL addressed.

---

## Commons

```
commons/
├── components/     # Reusable UI. Zero domain knowledge.
├── contexts/       # React contexts, split state/actions
├── hooks/          # Cross-feature hooks
├── systems/        # Self-contained subsystems (see below)
├── types/          # Types shared across layers
├── constants/      # Shared constants
└── utils/          # Pure functions, grouped by concern
```

`utils/` is grouped by concern, not flat:

```
utils/
├── typeChecks/
│   ├── isSpecificType.ts
│   ├── isNullOrEmpty.ts
│   └── equalityChecks.ts
├── formatting/
└── general/
```

---

## Systems

A **system** is my name for a self-contained subsystem that owns a concept end to end: its
types, its constants, its logic, and a single entry point. Not a service, not a manager, not a
helper. A system.

Two shapes, and which one you get depends on whether the system has runtime behaviour.

```
commons/systems/
└── breadcrumbsSystem/
    ├── breadcrumbsSystem.ts     # The entry point: the hook or the function you call
    └── modules/
        ├── types.ts
        └── utils.ts
```

```
commons/systems/
└── responseObjectSystem/
    ├── constants.ts             # A vocabulary system: no entry point, because there is
    ├── types.ts                 # nothing to call. Consumers import the factory, the guard
    └── utils.ts                 # or the type directly.
```

A **vocabulary system** is the exception to both the entry-file rule and the `modules/` rule, and
it is allowed only when the system genuinely has no behaviour to enter through: it defines a
shape, its constants, and the functions that build and check it. The moment it grows a hook, a
provider, or any state, it becomes the first shape, with an entry file and a `modules/`.

Something earns the `System` suffix when all of these are true:

- It owns a concept, not a task. "Permissions" is a system. "Format a date" is a util.
- It is used by more than one layer.
- It has its own vocabulary: types and constants that only make sense inside it.
- Replacing it would be a decision, not an edit.

When those are not all true, it is a util, a hook, or a component. The suffix is not decoration;
seeing `System` in an import should tell you that you are crossing into another concept's
territory.

What the shelf actually looks like on a mature project, so the bar is concrete: permissions,
breadcrumbs, navigation, browser detection, saved filters, an imperative portal, a cached-query
layer that keeps a static copy alongside the live one so a refetch never flashes empty, and an
unsaved-changes blocker that intercepts navigation on a dirty form. Fifteen or so, each one a
concept somebody would otherwise have reimplemented badly in three features.

---

## Imports

- **Relative paths.** No aliases. `../../../commons/...` is fine, and the depth is a useful
  signal: if it is getting absurd, the file is in the wrong place.
- **Grouped, separated by blank lines**, in this order:
  1. React and external packages
  2. Shared components
  3. Shared types, utils, constants, systems, contexts
  4. API layer
  5. Local `./modules/...`
  6. The unit's own `.scss`, last, always

```typescript
import React, { useCallback, useState } from "react";

import GenericModalComponent from "../../../commons/components/GenericModalComponent/GenericModalComponent";
import ButtonComponent from "../../../commons/components/ButtonComponent/ButtonComponent";
import InputComponent from "../../../commons/components/InputComponent/InputComponent";

import { ReturnEventType } from "../../../commons/types/returnEvent";
import { areEqual } from "../../../commons/utils/typeChecks/equalityChecks";

import { API_AddNoteType } from "../../../api/queries/notes/create/endpointTypes";
import { useAddNote } from "../../../api/queries/notes/create/endpointCalls";

import { ADD_NOTE_FEATURE_DEFAULT_VALUES as noteDefaultValues } from "./modules/constants";
import useAddNoteValidations from "./modules/addNoteValidations";
import { AddNoteFeatureType } from "./modules/types";
import "./AddNoteFeature.scss";
```

### The staircase

Within a group, single-line imports read best sorted by **descending visual length**: longest
first, so the block forms a staircase down to the right.

Be honest about what this is. It is a **preference, not a gate.** In the codebase this standard
was derived from it holds in the files I curated as references and in roughly a quarter to a
third of everything else, which is barely above chance. No tool enforces it, no review should
block on it, and it is not one of the tells in `AGENTS.md`. It is here because when a block does
have the staircase it reads noticeably better, and because a ragged edge in the middle of an
otherwise ordered block is usually where something got appended without a thought about where it
belonged.

Where it does not apply, and where you should not force it:

- **Multi-line imports** have no meaningful visual length. Put them at the **end of their group**,
  after the single-line ones, and stop there.
- **The first group.** `react` goes on the first line regardless of length, because it is always
  the first thing you look for.
- **Long flat import blocks** in generated-feeling files such as `api/queries/**` endpoint calls,
  which in practice are a single unordered block. Leave them alone rather than churning a diff to
  restack them.

### Rules that are not preferences

- **The `.scss` import is always the last line of the block.** It is a side effect, not a binding,
  and it sits at the bottom where side effects go.
- **Long constant names are aliased on import** to a short camelCase local:
  `import { ADD_NOTE_FEATURE_DEFAULT_VALUES as noteDefaultValues } from "./modules/constants";`.
  The exported name stays namespaced and searchable; the local name stays readable.
- **Blank lines separate the groups** in any file you are writing from scratch. Plenty of older
  files are a single flat block; that is drift, not a second convention, and it is not worth a
  reformatting commit on its own.

---

## `subComponents/`

When a feature or component owns children that are not reusable anywhere else, they go in
`subComponents/` next to it, each in its own folder with the same shape as any other component.

```
NoteBoard/
├── NoteBoardFeature.tsx
├── NoteBoardFeature.scss
├── modules/
└── subComponents/
    └── BoardHeaderComponent/
        ├── BoardHeaderComponent.tsx
        ├── BoardHeaderComponent.scss
        └── modules/types.ts
```

`subComponents/` means "owned by this parent, do not import from outside". The day something
outside needs it, it moves to `commons/components/` and stops being a sub-component. That move is
the signal that it became shared, and it should be a visible commit, not an import line that
quietly reaches across the tree.
