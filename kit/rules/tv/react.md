---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---

# TV-STANDARD: React

TV-PACK: react

Loaded in full because a React file was read. "TV NN" names the original chapter; the chapter map at the end of the core names the packs of each chapter.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

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

## What never appears in a component (TV 04)

- A raw `fetch` or `axios` call. Network access goes through the API layer, always.
- A hardcoded colour, spacing value or breakpoint. Those come from SCSS variables and mixins.
- Business rules that another component would need. Those go to a system, a util, or a hook.
- A `console.log` that survived the commit.
