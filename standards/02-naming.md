# 02 — Naming

Names are the interface. Everything in this file exists so that a name tells you what a thing is
and where it lives without opening it.

---

## The suffix rules

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

---

## Casing

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

---

## Booleans

Always a question the value answers.

- `is...` for state: `isLoading`, `isOpen`, `isAuthenticated`, `isNullOrEmpty`
- `has...` for possession: `hasPermission`, `hasUnsavedChanges`
- `should...` for intent: `shouldRefreshOnClose`
- `does...` for a predicate over something else: `doesToastIdExist`
- `are...` for comparisons and plurals: `areEqual`, `areNotEqual`

Never a bare noun. `loading`, `open`, `error` are not booleans, they are ambiguous.

---

## Handlers

Two forms, and both are in use, because they mean different things:

- `handle<Thing><Event>` for a handler that reacts to a UI event and mostly maps it to state:
  `handleNoteValueChange`, `handleRowClick`
- `<verb><Thing>Handler` for a handler that performs the operation:
  `addNoteHandler`, `deleteSelectedHandler`

Props that receive a handler are named `on<Event>`: `onClick`, `onClickAction`, `onSuccessHandler`.

---

## Hooks

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

---

## The `API_` prefix

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

## Constants

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

## Variables

- Full words. `response`, not `res`. Two carve-outs, both about scope rather than taste: a
  callback parameter whose entire scope is one line (`.then((res) => ...)`), and the parameter of
  a one-line type predicate (`(val: any): val is string`). Anything that lives longer than the
  line it is declared on gets a full word.
- No Hungarian notation, no type in the name, no abbreviations that are not universal.
- Loop and callback parameters are named for the item, never `item` or `x`:
  `prevToasts.some((toastDetails) => ...)`.
- A reduce accumulator is named for what it accumulates: `totalMinutes`, `cleanedPayload`,
  `groupedRows`. `accumulator` when there is genuinely nothing better to call it, `acc` when the
  reduce is one line. Do not rename an existing one.
- Previous state in a setState callback is `preState` or `prevToasts`, named for what it holds.

---

## Length is not a cost

A name that is long because it is precise is a good name. I will take
`genericModalParentRefForCustomScrollbarPositioning` over `modalRef` every time, because the long
one cannot be confused with the other three refs in the file.

The rule is not "long names". The rule is: **the name answers every question someone would have
to open the file to answer.** If it takes eleven words, it takes eleven words. If it takes two,
do not pad it.

Where the length genuinely hurts at the use site, alias it on import. Never shorten the
declaration.
