---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# TV-STANDARD: React

TV-PACK: react

Loaded in full because a React file was read. "TV NN" names the original chapter; docs/rules.md maps each chapter to its packs.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from AGENTS.md -->

## What I will notice immediately (AGENTS)

These are the tells. Get them wrong and the code reads as someone else's, even if it works:

| Tell | Right | Wrong |
| --- | --- | --- |
| Type naming | `AddNoteFeatureType` | `IAddNoteFeature`, `AddNoteProps` |
| Folder for a unit's internals | `modules/` | `helpers/`, `lib/`, `internal/` |
| Component name | `ButtonComponent` | `Button`, `AppButton` |
| Feature name | `AddNoteFeature` | `AddNote`, `NoteCreator` |
| Shared abstraction | `xSystem/` | `xManager/`, `xService/`, `xEngine/` |
| SCSS barrel | `xCaller.scss` with `@forward` | `_index.scss`, `@import` |
| String quotes | `"double"` | `'single'` |
| Trailing comma | none | any |
| Separator inside a component | `//-----------` | nothing, or a paragraph of prose |
| Empty check | `isNullOrEmpty(value)` | `!value`, `value === ""` |
| Entry file in a unit folder | `AddNote/AddNoteFeature.tsx` | `AddNote/index.tsx`, `AddNote/AddNote.tsx` |
| Equality on objects | `areEqual(a, b)` | `JSON.stringify(a) === JSON.stringify(b)` |

---

<!-- from standards/01-project-anatomy.md -->

## The tree (TV 01)

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

## The layer hierarchy (TV 01)

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

## The `modules/` convention (TV 01)

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

## Features (TV 01)

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

## Commons (TV 01)

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

## Systems (TV 01)

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

## Imports (TV 01)

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

## `subComponents/` (TV 01)

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

---

<!-- from standards/02-naming.md -->

## The suffix rules (TV 02)

These are the strongest tell in my code. They are absolute.

| Thing | Suffix | Example |
| --- | --- | --- |
| Type or interface | `Type` | `AddNoteFeatureType`, `NoteRowDataType` |
| Component | `Component` | `ButtonComponent`, `GenericModalComponent` |
| Feature | `Feature` | `AddNoteFeature`, `ManageNotesFeature` |
| Page | `Page` | `NotesPage`, `NoteDetailsPage` |
| Subsystem | `System` | `responseObjectSystem`, `permissionsSystem` |
| Context file | `Context` | `ToastContext.tsx`, `ToastContext.context.ts` |
| Controller hook | `Controller` | `useCreateController`, `useReadController` |
| Function-valued type | `FnType` | `CreateToastFnType`, `PerformApiServiceFnType` |
| Declarative config file | `Definition` | `columnsDefinition.tsx`, `defaultFiltersDefinition.ts` |
| Response/event handler module | `Handler` | `payloadDataHandlers.ts`, `onServiceResponseActionHandler` |
| Structural wrapper that renders children | `Layout` | `AppContextLayout`, `PageStructureLayout` |

And one prefix: `Generic` on a shared component that is the unopinionated base of a family:
`GenericModalComponent`, `GenericTableComponent`. `Generic` means "this knows nothing about your
use case, configure it"; its absence means the component has opinions.

Two deliberate variants on the `Type` suffix, because they carry information the plain form does
not:

- **Plural `Types`** for a union derived from an `as const` map: `ViewTypes`, `ToastStateTypes`,
  `UserRoles`. The plural says "one of a closed set".
- **`ResponseObj`** for a validation bag: `AddNoteButtonsValidationResponseObj`. It says the
  members are response objects with a `status` and a `msg`, not plain data.

No `I` prefix on interfaces. No `T` prefix on generics beyond the bare `T`. No `Props` suffix:
a component's props type is `<ComponentName>Type`, because the props **are** the component's
public shape.

```typescript
// Right
export interface AddNoteFeatureType {
  reloadNotes: RefreshDataHandlerFnType;
}

const AddNoteFeature: React.FC<AddNoteFeatureType> = ({ reloadNotes }: AddNoteFeatureType) => {

// Wrong
interface IAddNoteProps { ... }
interface AddNoteProps { ... }
```

Two declaration forms are current and both are fine:

```typescript
const AddNoteFeature: React.FC<AddNoteFeatureType> = ({ reloadNotes }: AddNoteFeatureType) => {

const AddNoteFeature = ({ reloadNotes }: AddNoteFeatureType) => {
```

The plain typed arrow is slightly the more common of the two and is the better default for new
code: it says the same thing once. `React.FC<T>` is required where the component is generic over
its row type, and it reads well on a short props list, where annotating **twice** is a deliberate
redundancy because the destructure is where people actually read what a component takes. On a wide
props list the second annotation is noise; drop it.

## Casing (TV 02)

| Kind | Casing | Example |
| --- | --- | --- |
| Component / Feature / Page file and folder | PascalCase | `ButtonComponent/ButtonComponent.tsx` |
| System folder and entry file | camelCase | `responseObjectSystem/responseObjectSystem.ts` |
| Shared hook file | camelCase, `use` prefix | `commons/hooks/debounce/useDebounce.ts` |
| A unit's own hook in `modules/` | camelCase, named for its job | `modules/addNoteValidations.ts` (exports `useAddNoteValidations`) |
| Util / module file | camelCase | `equalityChecks.ts`, `payloadDataHandlers.ts` |
| SVG file | kebab-case | `pdf-download.svg` |
| Type / interface | PascalCase + `Type` | `NoteRowDataType` |
| Constant | SCREAMING_SNAKE_CASE | `ADD_NOTE_FEATURE_DEFAULT_VALUES` |
| SCSS class (component) | PascalCase block, `__element` | `.AddNoteFeature__content` |
| SCSS utility class | snake_case | `.cursor_pointer`, `.background_color_accent` |
| SCSS mixin | snake_case | `@mixin display_flex_column_all_center` |
| SCSS variable | `$snake_case` | `$color_light_gray` |
| CSS custom property | `--kebab-case` | `--color-light-gray` |

The SCSS casing split is intentional: PascalCase means "this belongs to one component",
snake_case means "this is global and composable".

## Handlers (TV 02)

Two forms, and both are in use, because they mean different things:

- `handle<Thing><Event>` for a handler that reacts to a UI event and mostly maps it to state:
  `handleNoteValueChange`, `handleRowClick`
- `<verb><Thing>Handler` for a handler that performs the operation:
  `addNoteHandler`, `deleteSelectedHandler`

Props that receive a handler are named `on<Event>`: `onClick`, `onClickAction`, `onSuccessHandler`.

## Hooks (TV 02)

- `use<Entity><Operation>` for endpoint hooks: `useAddNote`, `useReadNote`, `useNotesLazyFetch`
- `use<Thing>Controller` for the API controllers: `useCreateController`
- `use<Thing>Validations` for validation hooks: `useAddNoteValidations`
- `use<Thing>Context` for context accessors: `useToastActionsContext`

A hook that returns more than one thing returns an **object**, never a tuple, unless it is
mirroring a React primitive. Tuples force the caller to invent names; objects carry them. A hook
that returns a single value returns it bare, with no wrapper.

```typescript
// Multiple values: a memoised object.
return useMemo(() => ({ API_AddNote, isLoading }), [API_AddNote, isLoading]);

// Single value: bare.
return debouncedValue;
```

## The `API_` prefix (TV 02)

Anything that is literally the network call, or the literal wire shape, is prefixed `API_`:

```typescript
export interface API_AddNoteType {
  title: string;
  body?: string;
}

const { API_AddNote, isLoading } = useAddNote();
```

The prefix is ugly and that is the feature. It makes a network call visually distinct from a
local function at the call site, so an accidental call inside a render loop is visible while
skim-reading.

---

<!-- from standards/04-react-components.md -->

## The file, top to bottom (TV 04)

Every component file has the same skeleton. Reading one means you can read all of them.

```typescript
// 1. Imports, grouped (see TV 01)
import React, { useCallback, useState } from "react";

import ButtonComponent from "../../../commons/components/ButtonComponent/ButtonComponent";

import { ReturnEventType } from "../../../commons/types/generic";

import { API_AddNoteType } from "../../../api/queries/notes/create/endpointTypes";
import { useAddNote } from "../../../api/queries/notes/create/endpointCalls";

import { ADD_NOTE_FEATURE_DEFAULT_VALUES as noteDefaultValues } from "./modules/constants";
import useAddNoteValidations from "./modules/addNoteValidations";
import { AddNoteFeatureType } from "./modules/types";
import "./AddNoteFeature.scss";

// 2. Declaration: a typed arrow, or React.FC<Type> when the props list is short
const AddNoteFeature: React.FC<AddNoteFeatureType> = ({ reloadNotes }: AddNoteFeatureType) => {
  // 3. State, then API hooks, then derived hooks. Nothing else.
  const [noteData, setNoteData] = useState<API_AddNoteType>(noteDefaultValues);
  const { API_AddNote, isLoading: isLoadingCreatingNote } = useAddNote();

  const { addNoteButtonsValidationResponseObj } = useAddNoteValidations({ noteData });
  const [isOpen, setIsOpen] = useState<boolean>(false);

  //-----------

  // 4. Handlers. Plain ones first, memoized ones after.
  const handleNoteValueChange = (event: ReturnEventType) => {
    const { name, value } = event.target;
    setNoteData((preState) => ({
      ...preState,
      [name]: value
    }));
  };

  const closeModal = useCallback(
    (refreshNotes = false) => {
      setNoteData(noteDefaultValues);
      setIsOpen(false);
      if (refreshNotes) reloadNotes();
    },
    [noteDefaultValues, reloadNotes]
  );

  const addNoteHandler = useCallback(() => {
    if (!addNoteButtonsValidationResponseObj.saveChanges.status) return;
    API_AddNote(noteData).then(() => closeModal(true));
  }, [addNoteButtonsValidationResponseObj.saveChanges, API_AddNote, noteData, closeModal]);

  //-----------

  // 5. Return. Nothing is declared after this point.
  return ( ... );
};

export default AddNoteFeature;
```

## The `//-----------` separator (TV 04)

A bare comment line of dashes separates the three regions of a component: **hooks**, **handlers**,
**render**. Nothing else goes between them.

It is not a section header, it has no label, and it is not decoration. It is a visual anchor that
tells you which third of the file your eye is in when you scroll into the middle of a long
component. Long-form banners (`// ------| Category |------`) are used in **registry and config
files**, where the sections are genuinely named categories. Components get dashes.

## Ordering inside the component body (TV 04)

1. `useState` for the primary data
2. API hooks (`useAddNote`, `useNotesLazyFetch`) with `isLoading` renamed to say what is loading
3. Validation hooks and derived hooks
4. Remaining `useState` for local UI flags
5. `//-----------`
6. Handlers
7. `useEffect`, after the handlers it calls, so nothing is referenced above its declaration
8. `//-----------`
9. `return`

**An effect that writes state is guarded with `areEqual`.** This is the compare-before-write
reflex at its most load-bearing: an effect that syncs fetched data into state will otherwise fire
on every re-fetch, because re-fetched data is deeply identical and referentially new.

```typescript
useEffect(() => {
  setNoteData((preState) => (areEqual(preState, treatedNoteData) ? preState : treatedNoteData));
}, [treatedNoteData]);
```

`isLoading: isLoadingCreatingNote` is the rule, not the exception. A component with two async
operations and two bare `isLoading` variables is a component where the spinner will eventually
lie to the user.

## Memoization discipline (TV 04)

- `useCallback` for anything passed down as a prop, used in a dependency array, or that performs
  an operation.
- Plain function for handlers that only map an event to a `setState` in the same component.
- `useMemo` on a hook's **returned object**, so consumers are not re-rendered by identity churn.
  A fresh object literal on every render is a new identity, and a new identity is a re-render in
  every consumer:

```typescript
return useMemo(() => ({ API_AddNote, isLoading }), [API_AddNote, isLoading]);
```

  This applies to hooks that return an object. A hook returning a single value returns it bare
  and needs no wrapper. Be honest that the codebase is not uniform here: plenty of older hooks
  return a bare literal. That is drift to fix when you are already in the file, not a reason for
  a sweep.

- `useRef` for values that must be current at call time but must not change a callback's
  identity. This is the correct tool for auth flags, "already processing" locks, and latest-props
  reads:

```typescript
// Ref keeps createToast identity stable across auth flips while still
// reading the latest auth value at call time.
const isAuthenticatedRef = useRef(isAuthenticated);
isAuthenticatedRef.current = isAuthenticated;
```

Dependency arrays are written honestly and exhaustively by hand. The exhaustive-deps lint rule is
off, because it is wrong often enough that obeying it mechanically produces worse code than
thinking about it. Off means "you are responsible", not "ignore it".

## Guard clauses and early returns (TV 04)

Guard first, then do the work. No `else` after a `return`.

```typescript
const addNoteHandler = useCallback(() => {
  if (!addNoteButtonsValidationResponseObj.saveChanges.status) return;
  API_AddNote(noteData).then(() => closeModal(true));
}, [...]);
```

A single-statement `if` gets **no braces and stays on the same line**. This is the dominant form
by a wide margin, for bare guards and for returned expressions alike:

```typescript
if (isNullOrEmpty(value)) return true;
if (matchIndex === -1) return false;
if (refreshNotes) reloadNotes();
```

It moves to the next line only when the single line would run past 100 characters, which is
Prettier's decision, not yours. A multi-statement `if` gets braces.

## Conditional rendering (TV 04)

Inline in the JSX, not as early returns from the component.

- `&&` for presence: the falsy branch renders nothing.
- Ternary for either/or, including inside strings and attributes.
- Early `return` from a component is rare: around 5% of components have one.

```tsx
{showBadge && <span className="ButtonBadge">{badge}</span>}
{customIcon && <div className="ButtonComponent__icon">{customIcon}</div>}

title={`Delete note${notesData.length > 1 ? "s" : ""}`}
```

**The one early return that is a rule, not an exception:** anything that mounts into a portal or
an overlay opens with a single-line null guard on its own open flag.

```typescript
if (!isOpen) return null;
```

Modals, drawers, popovers, notifications. This is the mount and unmount contract for the whole
overlay family: the component is either fully mounted or not in the tree at all, never mounted and
hidden with CSS. Hidden-but-mounted overlays keep focus traps alive, keep effects running, and
keep stale data on screen behind an opacity of zero.

## Nested ternaries (TV 04)

Nested ternaries happen. When one does, disable the rule **on the expression, with its reason**,
rather than stacking a bare file-wide disable at the top:

```typescript
// eslint-disable-next-line no-nested-ternary -- status is a three-way enum; a chain of ifs
// here would move the decision out of the JSX and away from what it renders.
const statusColor = isBlocked ? "red" : isPending ? "yellow" : "green";
```

A nested ternary that reads as a decision table is fine; one that
reads as a puzzle is not, and the difference is whether the branches line up vertically.

## Loading, empty and error are props, not branches (TV 04)

This is the part most people get wrong when copying this style.

A shared component takes `isLoading`, `noRowsReturnMsg`, `hideNoRowsReturnMsg` and renders its own
skeleton and its own empty state **internally**. The consumer does not branch on them.

```tsx
<DataViewerComponent
  rowsData={notes}
  isLoading={isLoadingNotes}
  noRowsReturnMsg="No notes found."
/>
```

At page level, the whole tri-state is delegated to a controller that hands back a ready-made node,
and the page falls through to its real content only when there is nothing to show instead:

```tsx
const result = useReadPageController({ data: noteDetails, isLoading });

return (
  result.defaultSystemRender || (
    <TabbedViewComponent ... />
  )
);
```

The principle: **tri-state handling is written once, in the component that owns the surface, not
at every call site.** A feature that writes its own spinner is a feature that will eventually
write a different spinner from the one next to it.

The corresponding obligation: a shared list, table or detail component that cannot render
loading, empty and error itself is not finished.

## The `classNames` object (TV 04)

Class composition is one object, declared before the `return`, with **one key per DOM part the
component renders**. Not `clsx`, not a ternary chain inside the JSX attribute.

```tsx
const classNames = {
  rootContainer: `ButtonComponent ButtonComponent--${size} ${customClassNames.rootContainer || ""} ${disabled ? "disabledAction" : ""}`,
  icon: `ButtonComponent__icon ${customClassNames.icon || ""}`,
  badge: `ButtonComponent__badge ${customClassNames.badge || ""}`
};

return <button className={classNames.rootContainer}>...</button>;
```

Rules:

- The variable is always called `classNames`.
- One key per DOM part, named for the part, matching the BEM element it carries.
- Within a value: base class, then modifiers, then the caller's `customClassNames.<part>` so the
  override wins, then the shared action-state classes.
- An inactive modifier contributes `""`, never `undefined`.
- Declared before the `return`, never inline in the attribute.

**Why an object rather than an array.** It pairs one-to-one with `customClassNames`, which is a map
mirroring the same DOM tree. A caller restyling the label of a three-part component passes
`customClassNames={{ label: "..." }}`, and the component has exactly one place that consumes it.
An array cannot express that, which is why the array form survives only on single-element
components, where `customClassName` is a plain string and there is one thing to name:

```tsx
const classNames = ["EmptyStateComponent", customClassName];

return <div className={classNames.join(" ")}>{message}</div>;
```

Between the two, this is the fastest tell in the whole standard.

## Props (TV 04)

- Configuration that belongs together travels together as one object prop:
  `confirmationButtonConfig={{ label, onClickAction, disabled, tooltipTitle }}`. Four related
  props become one named concept.
- A prop that takes a component is named `...Element` (`callerElement`), a prop that takes a
  config object is named `...Config` or `...Configs`.
- `customClassName` is the escape hatch prop on every shared component. One name, everywhere, so
  there is never a question of whether it is `className`, `class`, or `extraClass`.
- Defaults live in the destructure, not in the body, not in `defaultProps`.

## Shared components (TV 04)

A component in `commons/components/` has **zero domain knowledge**. It does not know what a note
is, what an invoice is, or what the app does. If it needs to, it is a feature.

Folder shape:

```
ButtonComponent/
├── ButtonComponent.tsx
├── ButtonComponent.scss
├── ButtonComponent.stories.tsx     # aspirational, see below
└── modules/
    ├── types.ts
    └── constants.ts
```

The story is in the shape because it should be, not because it always is: on a mature project I
have three stories against two hundred components. Storybook is installed and scripted and mostly
unused, and that is worth admitting rather than pretending. Write one when the component has
variants worth seeing side by side; do not write one out of duty.

The `.scss` file is named for the component and its root class is the component name. That
one-to-one mapping means a class in devtools tells you the file to open.

## Validation objects drive both the block and the reason (TV 04)

A feature's validation lives in a hook in `modules/`, and it returns a memoised map with **one
entry per UI affordance**. Each entry is a response object: a `status` and a `msg`.

```typescript
// modules/addNoteValidations.ts
if (isNullOrEmpty(noteData.title))
  return {
    actionTrigger: actionTriggerDefaultResponseObj,
    saveChanges: createResponseObject({ msg: "Note title is mandatory." })
  };
```

The component then consumes the **same object** for the disabled state and for the tooltip:

```tsx
disabled={!addNoteButtonsValidationResponseObj.saveChanges.status}
tooltipTitle={addNoteButtonsValidationResponseObj.saveChanges.msg}
```

This pairing appears in every Add, Edit and Delete feature, and it is the reason the UI never has
a disabled button with no explanation. The block and the reason come from one place, so they
cannot drift apart. A disabled control whose tooltip does not say why is a bug in this standard.

Make the rule structural where you can. `ButtonComponent` renders its own `TooltipComponent`
wrapper and takes `tooltipTitle` as a prop, so a button physically cannot be disabled without
somewhere to put the reason. A convention the component enforces is a convention nobody has to
remember.

## Escape hatches, in a fixed shape (TV 04)

Every shared component exposes the same vocabulary, and only this vocabulary:

```typescript
customClassNames?: {                       // the normal case: a map mirroring the DOM tree
  rootContainer?: string;
  label?: string;
};
customClassName?: string;                  // only where the component renders one element
styleConfigs?: React.CSSProperties;        // passed straight through to style
```

`customClassNames` is the common one by a wide margin, because most shared components render more
than one element, and it is what the `classNames` object above is shaped to consume. `rootContainer`
is always the key for the outermost element.

One vocabulary, everywhere. There is never a question of whether the prop is `className`, `class`,
`extraClass` or `sx`. If a component needs a third escape hatch, it is doing too much.

## The UI library stays behind a wrapper (TV 04)

Whatever component library the project uses, features never import from it. It is wrapped, once
per surface, in `commons/components/`, and everything above that line talks to my component's
props.

In practice this means a handful of files in the whole codebase import it, and all but the
provider are wrappers.

This applies to the **component library**, the one whose props would be all over the codebase and
whose next major version would be a migration. A single-purpose library used at exactly one site
(a date picker, a range slider, a QR code, a map) does not need a wrapper, and building one is
ceremony. The test is not "is it a dependency", it is "how many files would change if this
went away".

The reason is not purity. It is that swapping or upgrading a UI library is then a bounded piece
of work in a known set of files, instead of a codebase-wide migration. Every library I have used
has eventually had a major version that broke props.

The visible cost: a lot of `!important` in the SCSS, because my styles have to win against the
library's injected ones. I accept that trade openly rather than pretending it is not happening.

## Small idioms that add up (TV 04)

- **Keys are namespaced template literals**, never a bare index or a bare id:
  `key={\`NoteCard_${rowData.id}\`}`, `key={\`Delete_note_${noteData.id}\`}`.
- **Iteration variables are named for the item**: `.map((row) => ...)`, `.find((part) => ...)`,
  `.some((column) => ...)`. An `Instance` suffix (`noteInstance`, `columnInstance`) is for when
  the bare name would shadow something already in scope, which is roughly one callback in twenty.
  Not a blanket convention, and not worth a diff on existing code.
- **`treated` prefixes anything normalised** for display or for a payload: `treatedLabel`,
  `treatedUrl`, `treatEntityNameForApiCall`. If a value has been through a normalisation step,
  its name says so.
- **Prop spreading is essentially never used.** Props are enumerated. `{...props}` hides the
  contract.
- **`??` is the default fallback, not `||`.** Being honest about the evidence: the codebase this
  standard came from reaches for `||` about twice as often. That is a habit, not a decision, and
  it is the same falsy-coercion bug the `isNullOrEmpty` rule exists to prevent, because `0`, `""`
  and `false` are all values. Use `??`, and use `||` only where "empty" and "absent" genuinely
  mean the same thing at that call site.
- **Render-prop callbacks destructure a named bag**, never positional arguments:
  `cardConfigs={({ rowRefs, rowData, rowId, checked }) => ( ... )}`.

## What never appears in a component (TV 04)

- A raw `fetch` or `axios` call. Network access goes through the API layer, always.
- A hardcoded colour, spacing value or breakpoint. Those come from SCSS variables and mixins.
- Business rules that another component would need. Those go to a system, a util, or a hook.
- A `console.log` that survived the commit.

---

<!-- from standards/05-state-and-contexts.md -->

## No state library (TV 05)

React Context and `useState`. No Redux, no Zustand, no Jotai, no React Query.

This is a real decision with a real cost, and I take it deliberately. A state library buys
devtools, middleware and a community of patterns. It costs a dependency, a mental model everyone
has to learn, and a very strong gravitational pull toward putting things in global state that
have no business being there. In the projects I build, the trade goes the other way.

The consequence I accept: I have to be disciplined about re-renders myself. That is what the
state/actions split, the memoised provider value and the compare-before-write guard are for.

## The four-file context (TV 05)

Every context has the same shape. No exceptions, including the small ones. `utils.ts` is the
conditional fifth, present only when the context actually has helpers of its own.

```
contexts/Toast/
├── ToastContext.tsx                  # The provider component. Only the provider.
└── modules/
    ├── ToastContext.context.ts       # createContext + the accessor hooks
    ├── types.ts                      # The context value interfaces
    ├── constants.ts                  # defaultXContextVals
    └── utils.ts                      # When it needs them
```

The `.context.ts` split is the important part. `createContext` and the `useXContext` accessors
live there, so a consumer imports from `modules/ToastContext.context` and the provider imports
from `ToastContext.tsx`. Provider and consumer never import the same module, and the import cycle
that would otherwise appear the first time a context consumes another context never happens.

## The accessor hook (TV 05)

One generic accessor, shared by every context:

```typescript
export function useCustomContext<T extends DefaultContextValueBrandType>(context: Context<T>): T {
  const usingContext = useContext(context);
  if (usingContext.isDefaultContextValue)
    throw new Error("A context hook was used outside its Provider.");
  return usingContext;
}

export const useToastStateContext = () => useCustomContext(ToastStateContext);
export const useToastActionsContext = () => useCustomContext(ToastActionsContext);
```

`useContext` is never called directly in a component. Always through the named accessor. The
accessor is where "used outside its provider" becomes a loud error instead of no-op actions that
fail silently three renders later.

**The brand is load-bearing, and the obvious version of this guard is dead code.** Write
`if (!usingContext) throw ...` and it can never fire, because the next section mandates that every
context gets a real, non-null default object. A real default is truthy. The guard passes, the
component renders, and every action it dispatches goes into `emptyOnClick`.

So the default object carries a marker that a provider's value never sets:

```typescript
export interface DefaultContextValueBrandType {
  readonly isDefaultContextValue?: true;
}

export interface ToastStateContextType extends DefaultContextValueBrandType {
  toasts: ToastDetailsType[];
}

export const defaultToastStateContextVals: ToastStateContextType = {
  isDefaultContextValue: true,
  toasts: EMPTY_ARRAY
};
```

One optional field per context type, one line per default object, and the guard the accessor
promised actually fires. This is the same move as the response object's runtime brand, for the
same reason: structural guessing ("is it falsy?") fails silently, an explicit marker does not.

## Default values are real (TV 05)

Never `undefined`, never `null`, never `{} as ContextType`. A real object, built from shared
no-op sentinels:

```typescript
export const defaultToastStateContextVals: ToastStateContextType = {
  isDefaultContextValue: true,
  toasts: EMPTY_ARRAY,
  setToasts: emptyOnClick,
  clearAllToasts: emptyOnClick
};
```

`EMPTY_ARRAY`, `EMPTY_OBJ` and `emptyOnClick` live in `commons/constants/shared.ts` and are
module-level singletons. A fresh `[]` as a default is a new identity on every render, and a new
identity is a re-render. This is not micro-optimisation, it is the difference between a context
that is cheap and a context that is a performance bug.

**The exception, stated here rather than discovered later:** a context whose absence must be a hard
failure rather than a degraded no-op takes `createContext<T | null>(null)` and its accessor throws
on the null. The API context is the case. A component that renders without a toast provider is
merely silent; a component that renders without the API provider would be making requests into
nothing, and that has to stop at the accessor.

## Split state from actions (TV 05)

One provider, two contexts. Components that only dispatch do not re-render when the state
changes.

```tsx
return (
  <ToastActionsContext.Provider value={actionsValue}>
    <ToastStateContext.Provider value={stateValue}>{children}</ToastStateContext.Provider>
  </ToastActionsContext.Provider>
);
```

Actions outside, state inside. The actions value is memoised on its callbacks, which are stable,
so it effectively never changes. That is the whole point: `useToastActionsContext()` in a deeply
nested component costs nothing.

**The split is an escalation, not the default.** In practice it has earned itself exactly once, on
toast: everything in the app dispatches a toast and almost nothing reads the list. Eight other
contexts are a single memoised context and are right to be. Reach for the split when a context's
actions are consumed by components that do not read its state, and you can name those components.
Otherwise the second context is ceremony.

Where a context gets large without that asymmetry, the answer is controller decomposition, below,
not a split.

## Refs for "current at call time, stable by identity" (TV 05)

When a callback must read the latest value of something but must not change identity when that
value changes, the value goes in a ref, assigned **in the render body**, not in an effect.

```typescript
// Ref keeps createToast identity stable across auth flips while still
// reading the latest auth value at call time.
const isAuthenticatedRef = useRef(isAuthenticated);
isAuthenticatedRef.current = isAuthenticated;
```

Assigning in the render body rather than in `useEffect` means the ref is never stale mid-render.
This is the correct tool for auth flags, "already processing" locks, latest-props reads, and
anything a long-lived callback closes over.

## Decompose large contexts into controllers (TV 05)

When a context owns several unrelated slices, each slice becomes a `use<Slice>ContextController`
hook in `modules/`, owning its own state and its own storage key. The provider merges them and
does nothing else.

```typescript
const { savedViewType, setSavedViewType } = useSavedViewTypeContextController();
const { appTheme, setAppTheme } = useAppThemeContextController();

const value = useMemo(
  () => ({ savedViewType, setSavedViewType, appTheme, setAppTheme }),
  [savedViewType, setSavedViewType, appTheme, setAppTheme]
);
```

The provider's job becomes composition. Each controller stays independently readable and
independently testable, and adding a sixth preference does not make the provider a 300-line file.

Storage keys are module-local to their controller, in `@APP:SCREAMING` format:

```typescript
const USER_PREFERENCES_THEME_STORAGE_KEY = "@APP:THEME";
```

The constant name follows `<SCOPE>_<THING>` like any other. The stored key is the short
`@APP:SCREAMING` form, because that one is read by a human in devtools.

## Composition site (TV 05)

All providers are nested explicitly in one place, in one visible order, inside a single
`AppContextLayout` in `routes/router.tsx`.

No `composeProviders` helper, no array of providers reduced into a tree. The nesting order is
load-bearing information: it tells you which context can consume which. A helper hides exactly
the thing you need to see.

```
NormalizeCurrentRoute -> Auth -> Toast -> API -> AppState -> UserPreferences -> AppShell -> <Outlet />
```

Write that order down in the project's `CLAUDE.md`. It is the first thing anyone needs and the
last thing anyone finds.

**Toast sits above API on purpose.** The API layer's default success and error handler is
`showToast`, so anything in or under the API provider has to be able to reach the toast actions.
Order the chain by that rule generally: a provider goes above every provider that its defaults
depend on. When you cannot satisfy it, that is the signal the dependency belongs in the consumer
rather than in the provider's defaults.

## Local state (TV 05)

- One `useState` per concept, not one object holding six unrelated flags.
- Form data is the exception: one `useState` holding the payload shape, updated by name:

```typescript
const handleNoteValueChange = (event: ReturnEventType) => {
  const { name, value } = event.target;
  setNoteData((preState) => ({
    ...preState,
    [name]: value
  }));
};
```

That handler is written once per form and every field uses it. Fields are wired by `name`, which
matches the payload key, which matches the API type. One rename propagates everywhere or fails
to compile.

- Derived values are computed during render, never mirrored into state. State that can be derived
  is state that can disagree.

---

<!-- from standards/06-api-layer.md -->

## The API layer (TV 06)

This is the layer I care most about and the one that most reveals how I think. It exists to make
one guarantee: **by the time data reaches a component, it has a type that is true.**

## The three layers (TV 06)

```
endpointCalls.ts             (domain hook: useAddNote, useNotesLazyFetch)
  -> CRUD controller         (useCreateController, useReadController, ...)
    -> PerformApiService     (axios, response handling, error routing)
      -> responseDataTypeGuard   (validates the shape the server actually sent)
```

Each layer has exactly one job:

| Layer | Job | Knows about |
| --- | --- | --- |
| `endpointCalls` | This endpoint: its URL, its payload, its validation, its success message | The domain |
| Controller | This *kind* of operation: loading state, double-submit lock, default handlers | Operations, not domains |
| Service | Talking to the network and turning any outcome into a response object | HTTP |
| Type guard | Whether the payload is the shape we claimed | One payload |

No layer reaches past its neighbour. A component never sees axios; a service never knows what a
note is.

## The controller table (TV 06)

Fixed. One controller per operation, one hook-naming pattern per controller.

| Operation | Controller | Hook pattern | HTTP | Default success |
| --- | --- | --- | --- | --- |
| Create | `useCreateController` | `useAdd<Entity>()` | POST | `showToast` |
| Read | `useReadController` | `useRead<Entity>({ id })` | GET | silent |
| Update | `useUpdateController` | `useEdit<Entity>()` | PATCH | `showToast` |
| Delete | `useDeleteController` | `useDelete<Entity>()` | DELETE | `showToast` |
| List | `useLazyFetchController<T>` | `use<Entity>LazyFetch(filters)` | POST | silent |

Default error handler for every one of them:
`{ action: "showToast", showConsoleMessage: true }`.

Reads are silent because a successful read is not news. Mutations toast because a mutation is
something the user did and needs confirmed.

## The endpoint hook (TV 06)

```typescript
export const useAddNote = () => {
  const { createInstance, isLoading } = useCreateController();
  const { createSuccessfulToast } = useToastActionsContext();

  const API_AddNote = useCallback(
    async (noteDetails: API_AddNoteType) => {
      const entityName = treatEntityNameForApiCall({
        defaultEntityName: "note",
        entityNameOptions: { name: noteDetails.title }
      });

      const cleanedNoteDetails = removeEmptyPayloadProperties(noteDetails);

      return createInstance({
        entityName,
        configs: { url: NOTES_API_URL.create, data: cleanedNoteDetails },
        onSuccessHandler: {
          action: () => createSuccessfulToast(`${entityName} added successfully.`)
        },
        extraValidationsBeforePerformingApiService: () => {
          const validation = validateRequiredPayloadDataForAddNote(cleanedNoteDetails);
          if (!validation.status)
            return createResponseObject({
              msg: getRequiredFieldUndefinedErrorMsg({
                actionType: "add",
                entityName: "note",
                fieldName: validation.statusCodeMsg,
                customReason: validation.msg
              })
            });
          return undefined;
        }
      });
    },
    [createInstance, createSuccessfulToast]
  );

  return useMemo(() => ({ API_AddNote, isLoading }), [API_AddNote, isLoading]);
};
```

Read the shape:

- Named export, `use<Operation><Entity>`.
- Returns a memoised object with the `API_`-prefixed call and `isLoading`.
- The payload is cleaned before it is sent, so the server never has to tell "absent" from "blank".
- Validation runs **before** the request through `extraValidationsBeforePerformingApiService`,
  which returns `undefined` when valid. Not a boolean. A response object or nothing, so the
  failure carries its own message.
- The success message is built at this layer, because this is the only layer that knows what the
  user just did.

## Folder shape (TV 06)

```
api/
├── configs/                              # The machinery. Domain-free.
│   ├── controllers/CRUD/
│   ├── services/
│   └── modules/handlers/
└── queries/
    └── notes/
        ├── endpointsDefinition.ts        # All URLs for this entity, in one object
        ├── create/
        │   ├── endpointCalls.ts
        │   ├── endpointTypes.ts
        │   └── validateRequiredPayloadData.ts
        ├── read/
        └── lazyFetch/
```

```typescript
export const NOTES_API_URL = {
  create: "/notes",
  update: "/notes",
  delete: "/notes/multiple-soft-delete",
  search: "/notes/search",
  read: "/notes/{id}"
};
```

Every URL for an entity in one object, with `{id}` placeholders left literal so the interpolation
happens in one known place.

**This is an invariant, not a convention.** Zero URL string literals inside an `endpointCalls`
file, on any entity, ever. A backend renaming a route becomes one edit in one file, and grepping
`endpointsDefinition` enumerates the app's entire surface against the server. The moment one URL
is inline, that stops being true and nobody notices until the next rename.

## Validation (TV 06)

Complex validation gets its own file in the operation folder, exporting
`validateRequiredPayloadDataFor<Operation><Entity>`. Simple `edit`/`delete` validation can be
inline.

It returns a response object where `statusCodeMsg` carries the **field name** that failed, so the
message builder upstream can name it without the validator needing to know how messages are
phrased.

## Double-submit is handled once (TV 06)

The controller holds a `processingRef` and rejects a second call while the first is in flight,
with a `handledRejection: true` response object. Not a disabled button in every feature. Not a
debounce in every form. Once, in the layer that owns the operation.

```typescript
if (processingRef.current)
  return Promise.reject(
    createResponseObject({
      msg: "Action blocked: create already processing.",
      handledRejection: true
    })
  );
```

That is the pattern for every cross-cutting concern in this layer: solve it at the controller,
never at the call site.

---

<!-- from standards/08-comments-and-docs.md -->

## Trailing comments on dependency arrays (TV 08)

When a dependency array is non-obvious, it is justified on the same line. This is the one place a
trailing comment beats a comment above.

```typescript
}, [location.key, navigate]); // location.key as a dependency for guaranteed execution on every navigation.
```

Since `react-hooks/exhaustive-deps` is off, a dependency array is a claim about intent. A
deliberately incomplete one without a note is indistinguishable from a mistake.
