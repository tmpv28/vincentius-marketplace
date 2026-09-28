---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
---

# TV-STANDARD: TypeScript

TV-PACK: typescript

Loaded in full because a TypeScript or JavaScript file was read. "TV NN" names the original chapter; the chapter map at the end of the core names the packs of each chapter.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

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

import { ReturnEventType } from "../../../commons/types/generic";
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
block on it, and it is not one of the tells in "What I will notice immediately". It is here because when a block does
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
code: it says the same thing once. A component generic over its row type must be the plain typed arrow
(`<T,>(props: PropsType<T>) => ...`), because `React.FC` cannot carry a type parameter. `React.FC`
reads well on a short props list, where annotating **twice** is a deliberate
redundancy because the destructure is where people actually read what a component takes. On a wide
props list the second annotation is noise; drop it.

## Handlers (TV 02)

Two forms, and both are in use, because they mean different things:

- `handle<Thing><Event>` for a handler that reacts to a UI event and mostly maps it to state:
  `handleNoteValueChange`, `handleRowClick`
- `<verb><Thing>Handler` for a handler that performs the operation:
  `addNoteHandler`, `deleteSelectedHandler`

Props that receive a handler are named `on<Event>`: `onClick`, `onClickAction`, `onSuccessHandler`.

## Hooks (TV 02)

- `use<Operation><Entity>` for endpoint hooks: `useAddNote`, `useReadNotes`; a lazily
  fetched (paged) list is `use<Entity>LazyFetch`: `useNotesLazyFetch`. A list read in one call is a
  plain read through the read controller, like `useReadNotes`.
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

## Constants (TV 02)

SCREAMING_SNAKE, declared `as const`, named `<SCOPE>_<THING>`:

```typescript
export const RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS = {
  success: "SUCCESS",
  error: "ERROR",
  warning: "WARN"
} as const;

export const ADD_NOTE_FEATURE_DEFAULT_VALUES: API_AddNoteType = {
  title: "",
  body: ""
};
```

When the long name hurts readability at the use site, alias it on import rather than shortening
the declaration:

```typescript
import { ADD_NOTE_FEATURE_DEFAULT_VALUES as noteDefaultValues } from "./modules/constants";
```

The declaration stays searchable and unambiguous. The use site stays readable. Both win.

---

<!-- from standards/03-typescript.md -->

## `interface` vs `type` (TV 03)

- **`interface`** for object shapes that describe a thing: props, entities, payloads, context
  values. Anything someone might extend.
- **`type`** for unions, function types, mapped types, conditional types, and anything derived
  from another type.

```typescript
// An object shape someone will extend: interface.
export interface ToastDetailsType {
  id: string;
  type: ToastStateTypes;
  title: string;
}

// Derived from another type: type.
export type PersistedToastDetailsType = ToastDetailsType & { dismissedAt: string };

// A function shape: type, and it ends in FnType.
export type CreateToastFnType = (
  type: ToastStateTypes,
  titleOrToastCreationObj: string | Omit<ToastCustomizableConfigsType, "type">
) => void;
```

Function types are always a `type` and always end in `FnType`.

The response object is the worked example of this split and it is defined **once**, in
TV 06. Do not restate it here or anywhere else; a type this widely referenced drifts
the moment it has two copies.

## Do not create trivial alias types (TV 03)

If a hook takes only an existing type with nothing added, use that type inline. Do not create
`type AddNoteArgsType = DefaultEndpointHandlingType;` so that the name matches the file.

Create a named `interface` extending the base only when you are actually adding attributes:

```typescript
// Adds attributes: worth a named interface.
export interface ReadNoteEndpointType extends DefaultEndpointHandlingType {
  id?: string;
  isFetchEnabled?: boolean;
}
```

## Constants as the source of types (TV 03)

Declare the constant `as const`, then derive the type from it. Never maintain a union by hand
next to an object that already contains the same information.

```typescript
export const RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS = {
  success: "SUCCESS",
  error: "ERROR",
  warning: "WARN"
} as const;

export type ResponseObjectDefaultStatusCodeMsgs =
  (typeof RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS)[keyof typeof RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS];
```

**Enums are never used.** Not `enum`, not `const enum`. `as const` objects give the same
guarantees, better inference, no runtime artefact, and they serialise as what they are.

The pattern comes as a set of three files in one folder, and the third one is the part people
skip:

```
commons/modules/viewTypes/
├── constants.ts   # VIEW_TYPES = { list: "list", cards: "cards" } as const
├── types.ts       # ViewTypes = (typeof VIEW_TYPES)[keyof typeof VIEW_TYPES]
└── utils.ts       # validateStringForViewType(wanted?: string | null): ViewTypes
```

```typescript
// The coercion, not the assertion. Anything arriving from a URL, localStorage or a server
// is a string, and a string is not a ViewTypes until something has checked.
export const validateStringForViewType = (wanted?: string | null): ViewTypes => {
  if (wanted === VIEW_TYPES.cards) return VIEW_TYPES.cards;
  return VIEW_TYPES.list;
};
```

A union type with no coercion function next to it is an unfinished vocabulary. Casting a stored
string with `as ViewTypes` is the bug that coercion exists to prevent.

Constant object keys are camelCase; the values are the wire or human string.

## Branded types (TV 03)

When a constraint cannot be expressed structurally, brand it. The brand is documentation the
compiler enforces.

```typescript
export type NaNDateType = Date & { __invalidDateBrand: true };
export type GuidType = `${string}-${string}-${string}-${string}-${string}`;
export interface ResponseObjectType<T = any> extends BaseResponseObjectType<T> {
  isResponseObjectType: true;
}
```

Runtime brands (`isResponseObjectType: true`) are checked in the guard rather than with
`instanceof`, because the object crosses serialisation boundaries and `instanceof` does not.

## Generics (TV 03)

Single `T` for the payload type, defaulted to `any` when the type is genuinely unknown at that
boundary. Multi-letter generic names only when there are several and they need telling apart.

The rule that matters: **a generic should flow, not be re-declared**. If `T` is inferred at the
bottom of a chain, every layer above it takes `T` and passes it on. The moment a layer pins it
to a concrete type, the chain is broken and everything above loses its typing.

```typescript
// The attributes carry T, so every layer can name the same shape without restating it.
export interface PerformApiServiceAttrbsType<T = any>
  extends SharedAttributesBetweenControllerAndService<T> {
  actionType: ApiControllerActionType;

  onSuccessHandler: OnServiceResponseActionHandlerType;
  onErrorHandler: OnServiceResponseActionHandlerType;
}

// T is inferred from the type guard at the call site, and flows all the way back up.
export type PerformApiServiceFnType = <T = any>(
  attrbs: PerformApiServiceAttrbsType<T>
) => Promise<SuccessResponseObjectType<T>>;
```

Note what this is: a **generic function type**, not a generic type alias. `PerformApiServiceFnType`
takes no type parameters of its own, so `PerformApiServiceFnType<T>` is a compile error
(`TS2315`). The `<T>` sits on the call signature, which is what lets each call infer its own `T`.
When a layer needs to name the argument shape at a fixed `T`, it names
`PerformApiServiceAttrbsType<T>` instead. Extracting that interface is not ceremony; without a
named attributes type you cannot pass the shape into a `useCallback` without copy-pasting the
inline intersection.

## Type guards (TV 03)

Guards are how untrusted data becomes trusted data. They live at the boundary, and nowhere else.

```typescript
export const isResponseObjectType = (obj: any): obj is ResponseObjectType => {
  return isObject(obj) && "isResponseObjectType" in obj && obj.isResponseObjectType === true;
};
```

Rules:

- A guard is a predicate: `(value: any): value is X`. It returns a boolean and does nothing else.
- The guard's parameter is the **raw shape** being inspected, not the narrowed value. Getting
  this depth wrong is the single most common bug in a typed API layer.
- Branded objects carry an explicit marker field (`isResponseObjectType: true`) rather than
  being guessed at structurally. Structural guessing breaks silently when a payload changes.

## Function overloads for shape-dependent returns (TV 03)

When the return type genuinely depends on the arguments, overload it. Do not return a union and
make every caller narrow it.

```typescript
export function createResponseObject<T>(
  opts: Partial<BaseResponseObjectType<T>> & { status: true }
): SuccessResponseObjectType<T>;
export function createResponseObject<T>(
  opts?: Partial<BaseResponseObjectType<T>>
): FailedResponseObjectType<T>;
export function createResponseObject<T>({ ... }): ResponseObjectType<T> {
  ...
}
```

This is the one place where the extra ceremony pays for itself forever: `status: true` at the
call site means `data` is non-optional for every consumer downstream.

## Props interfaces: blank lines instead of comments (TV 03)

Group related props with blank lines. The grouping does the work a comment would have done, and
it cannot go stale.

```typescript
export interface InputComponentType {
  label?: string;
  value?: HandledReturnInputValueType;
  placeholder?: string;

  isLoading?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;

  onChange?: (event: React.ChangeEvent<HTMLInputElement> | ReturnEventType) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (inputValue?: HandledReturnInputValueType) => void;
}
```

Content, then state, then handlers. Same order in the interface, same order in the destructure,
same order in the JSX where it is reasonable.

**Nearly every prop is optional.** The required set is minimal: the entity payload, `children`,
`name`. Everything else has a default in the destructure. A component with eleven required props
is a component that is hard to use and impossible to extend, and the defaults are where the
component states its own opinion about the common case.

`Readonly<>` is not used. Immutability here is a convention, enforced by nobody mutating props,
not by a wrapper type on every interface.

## Arguments (TV 03)

**Object arguments once there are two or more.** Positional arguments are for single-parameter
functions and for things that mirror a React primitive.

```typescript
// Right
export const getRequiredFieldUndefinedErrorMsg = ({
  actionType,
  entityName,
  fieldName,
  customReason
}: GetRequiredFieldUndefinedErrorMsgType): string => ...

// Wrong
getRequiredFieldUndefinedErrorMsg("add", "note", "title", undefined);
```

Call sites read as documentation, argument order stops being load-bearing, and adding an
optional argument stops being a breaking change.

## Declaration style (TV 03)

- `const` arrow functions by default. `function` for three cases: overloaded functions,
  hoisting-dependent helpers, and **type predicates**, which read better as declarations and are
  often referenced above their definition inside a `modules/` file of related checks.
- Named exports by default. Default export only for a component, feature, page, a controller hook
  or a validation hook, where the file **is** the thing.
- Destructure at the parameter, with defaults inline:

```typescript
const useCreateController = ({ initialLoading = false }: UseCreateControllerConfigType = {}) => {
```

## The type-check kernel is mine, not a library's (TV 03)

`commons/utils/typeChecks/` is hand-written: nine one-line predicates in `isSpecificType.ts`, plus
`isNullOrEmpty` and the `areEqual` family in their own files. Three files, a few hundred lines, and
imported by more files than anything else in the codebase.

It has no external dependency. The codebase this standard was derived from carries a fourth file,
`isTypeValid`, and imports lodash's `isNaN` for it. That contract is written down nowhere, so the
template does not reconstruct it, and nothing in the kernel needs it: the one NaN check the kernel
makes is on a date's `getTime()`, which is always a number, so `Number.isNaN` is exactly right
there and the global `isNaN`, which coerces, never appears.

This is deliberate. A dependency for `typeof val === "string"` is a dependency I have to audit,
version, and eventually migrate off. And a library's `isEmpty` has its own opinion about what
empty means, which will not be mine.

```typescript
export function isString(val: any): val is string {
  return typeof val === "string";
}
```

Note the shape: `export function`, not an arrow, and always a type predicate. They are predicates
first and conveniences second.

`isNullOrEmpty` is the one that earns its keep. It treats `null`, `undefined`, `""`, `"   "`,
an invalid `Date`, `[]` and `{}` as the same answer, and explicitly does **not** treat `0` or
`false` as empty:

```typescript
if (isNumber(value) || isBoolean(value)) return false;
if (isString(value) && /^\s*$/.test(value)) return true;
```

Never `!value` as an emptiness check. `0`, `""` and `false` are all values, and the day one of
them is legitimate the bug is silent.

## Compare before you write (TV 03)

`areEqual` is a hand-rolled, recursive, **order-agnostic** deep equality that normalises dates to
the second. It exists so that every write can be guarded:

```typescript
if (!areEqual(treatedTheme, currentThemeInUse))
  document.documentElement.setAttribute("data-appTheme", treatedTheme);

setNotes((prevNotes) => (areEqual(prevNotes, nextNotes) ? prevNotes : nextNotes));
```

This is a reflex, not an optimisation pass. Every `setState`, every storage write, every DOM
attribute write, every effect body that reacts to fetched data gets the guard. Re-fetched data is
almost always deeply identical and referentially new, and without the guard that difference
propagates as a render storm through half the tree.

Two things about the default behaviour that you have to know before you guard a write with it:

- **It is order-agnostic**, because a backend reordering a collection is usually not a change to
  the user. It is the wrong default the moment order is meaningful: a list the user can drag, a
  sorted table, a ranked result set. For those, guard with `areEqualInOrder`, where a move is the
  change.
- **It conflates every flavour of empty.** `areEqual("", null)` and `areEqual([], {})` are both
  true. So it must never guard a write that swaps one empty value for another, which is exactly
  what a "clear this field" payload does when it sends `null` where `""` used to be.

Dates and ISO strings normalise to **the second**, not finer and not coarser. Finer and a payload
that differs only in milliseconds reads as a change; coarser and 10:00:05 compares equal to
10:00:59, which is a real difference in any "last updated" field.

A hand-rolled recursive comparison also has to survive a cyclic graph, because a re-fetch
comparison is precisely where the two graphs are distinct and a parent pointer will overflow the
stack. Remember the pairs already being compared and treat a repeat as equal.

## Lodash (TV 03)

**Not a default dependency.** A new project does not start with it, because the predicates it
would be pulling in are the ones `typeChecks/` already owns.

It gets added only for something genuinely fiddly that is not worth hand-writing, and then the
addition is justified by name in the PR: `throttle` and `debounce` are the realistic candidates.
If a lodash import shows up in a diff for `isEmpty`, `isEqual` or an `isX` predicate, the answer
is the type-check kernel, not the dependency.

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

## The response object (TV 06)

Everything returns a `ResponseObjectType`. Successes, failures, validation refusals, aborts.

```typescript
export interface BaseResponseObjectType<T = any> {
  status: boolean;
  statusCodeMsg: string;
  httpStatus?: number;
  msg: string;
  data?: T;
  headers?: any;
  handledRejection: boolean;
}

export interface ResponseObjectType<T = any> extends BaseResponseObjectType<T> {
  isResponseObjectType: true;
}

export type SuccessResponseObjectType<T = any> = ResponseObjectType<T> & {
  status: true;
  data: T;
};

export type FailedResponseObjectType<T = any> = ResponseObjectType<T> & { status: false };
```

Narrowing only happens on a **literal** `true`. `createResponseObject({ status: someBoolean })`
resolves to the failed overload no matter what `someBoolean` turns out to be, so pass the literal
or build the object in the branch that knows.

Two things make it work:

1. **The runtime brand.** `isResponseObjectType: true` survives serialisation, unlike
   `instanceof`, so anything anywhere can ask "is this one of mine?" and get a real answer.
2. **The overloaded factory.** `status: true` at the call site narrows the return type so `data`
   stops being optional for every consumer downstream. That single overload pair removes
   thousands of `?.` from the codebase.

`handledRejection` is the field that stops double-reporting: it marks a rejection that already
showed the user something, so an outer `.catch` knows to stay quiet.

This object is not only for HTTP. Validation functions return it. Permission checks return it.
Anything that can refuse returns it. One vocabulary for "did this work and why not".

## The type guard (TV 06)

The guard is where `any` stops. It receives the **raw** `response.data`, which means its depth
has to match the shape the backend actually sends, and the `.then()` that consumes it has to
match the guard.

```typescript
// Server returns the entity directly: .then() reads res.data
responseDataTypeGuard: (responseData): responseData is NoteType =>
  isObject(responseData) && isString(responseData.id) && isString(responseData.title);

// Server wraps it: .then() reads res.data.data
responseDataTypeGuard: (
  responseData
): responseData is ResponseDataContaining<{ data: NoteType }> => isObject(responseData?.data);

// Array payload, shape unknown per entry
responseDataTypeGuard: (responseData): responseData is ResponseDataContaining<{ data: any[] }> =>
  isArray(responseData?.data);
```

**The claim in the predicate has to match what the check actually proves.** A guard written
`(responseData): responseData is NoteType => !isUndefined(responseData)` is a lie with a type
annotation on it: it tells the compiler the payload is a `NoteType` while checking only that the
server sent something at all, and every layer above then treats `any` as a trusted entity. That
is worse than no guard, because no guard leaves `T` as `any` and the `any` is visible.

Two honest options when you cannot afford a field-by-field check:

- Check the fields the code downstream actually reads. Usually that is two or three of them.
- Widen the claim to what you really verified: `responseData is Record<string, any>`, or
  `ResponseDataContaining<{ data: any[] }>` for an array whose entries you have not inspected.

`T` is inferred from the guard's predicate and then flows, unchanged, all the way back up: the
service's call signature is generic in `T`, the controller's is too, and the `.then()` callback
receives `SuccessResponseObjectType<T>`. No guard means `T` falls back to `any`, which is a
choice, and a visible one.

The function types themselves are **not** generic aliases; the `<T>` lives on the call signature
so each call infers its own. See TV 03 for why, and for the named
`PerformApiServiceAttrbsType<T>` that layers use when they need to spell the argument shape.

**Guard depth must match `.then()` depth.** This is the single most common bug in this layer and
it is silent, because both sides compile.

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

## JSDoc (TV 08)

Reserved for things that are shared and load-bearing: exported utilities, factory functions,
system entry points, anything whose parameters are not self-evident.

Terse. `@param` and `@returns`, no prose essay.

```typescript
/**
 * Creates a generic response object for process flow handling.
 * @param opts - See {@link BaseResponseObjectType}.
 * @returns The response object, with `isResponseObjectType` set so guards can recognise it.
 */
```

A one-line `//` above a prop beats a `/** */` block, unless the prop's behaviour is genuinely
non-obvious.

### Object arguments document their shape, not their fields

Read the example above again. It documents one `@param` for an argument with seven fields, and
that is deliberate.

Every function here takes an object once it has two or more parameters, so this is the normal case
and not an edge one. A documentation generator binds only the **first** `@param` to a destructured
object argument. The rest are dropped silently, and the survivor is rendered as the name of the
whole object. Verified with TypeDoc.

```typescript
// Wrong. Only status survives, mislabelled as the entire argument.
/**
 * @param status - Indicates whether the process was successful (default: false).
 * @param statusCodeMsg - Specific status code message for further inspection.
 * @param msg - Description of the process status.
 * @param data - Optional data payload associated with the response.
 */
```

That block generates a reference page listing a single parameter, named `status`, typed as the
entire interface. The three descriptions below it are gone, and nothing warns you.

So field descriptions go on the interface, one line of TSDoc per property. The function keeps its
intent line, one `@param` naming the object and pointing at the shape with `{@link}`, and
`@returns`.

This is not a preference. Written the other way the generated reference is quietly wrong, and it is
wrong in the same way on every function in the codebase.

---

<!-- from standards/04-react-components.md -->

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

---

<!-- from standards/04-react-components.md -->

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

---

<!-- from standards/04-react-components.md -->

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
