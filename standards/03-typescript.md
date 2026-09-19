# 03 — TypeScript

## `strict`, always

`strict: true` from the first commit. Turning it on later is a project, turning it on now is a
setting.

Non-negotiable compiler options:

```json
{
  "strict": true,
  "forceConsistentCasingInFileNames": true,
  "noFallthroughCasesInSwitch": true,
  "isolatedModules": true
}
```

---

## `interface` vs `type`

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
`06-api-layer.md`. Do not restate it here or anywhere else; a type this widely referenced drifts
the moment it has two copies.

---

## Do not create trivial alias types

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

---

## Constants as the source of types

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

---

## Branded types

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

---

## Generics

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

---

## Type guards

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

---

## Function overloads for shape-dependent returns

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

---

## Props interfaces: blank lines instead of comments

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

---

## Arguments

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

---

## Declaration style

- `const` arrow functions by default. `function` for three cases: overloaded functions,
  hoisting-dependent helpers, and **type predicates**, which read better as declarations and are
  often referenced above their definition inside a `modules/` barrel of related checks.
- Named exports by default. Default export only for a component, feature, page, or a controller
  hook, where the file **is** the thing.
- Destructure at the parameter, with defaults inline:

```typescript
const useCreateController = ({ initialLoading = false }: UseCreateControllerConfigType = {}) => {
```

---

## The type-check kernel is mine, not a library's

`commons/utils/typeChecks/` is hand-written: eight one-line predicates in `isSpecificType.ts`, plus
`isNullOrEmpty`, `isTypeValid` and `areEqual` in their own files. Four files, around 300 lines, and
imported by more files than anything else in the codebase.

It has exactly one external dependency, and it is worth knowing why: lodash's `isNaN`, because the
global `isNaN` coerces and `Number.isNaN` does not accept the non-numeric inputs these predicates
have to survive.

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

---

## Compare before you write

`areEqual` is a hand-rolled, recursive, **order-agnostic** deep equality that normalises dates to
minute precision. It exists so that every write can be guarded:

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

---

## Lodash

**Not a default dependency.** A new project does not start with it, because the predicates it
would be pulling in are the ones `typeChecks/` already owns.

It gets added only for something genuinely fiddly that is not worth hand-writing, and then the
addition is justified by name in the PR: `throttle` and `debounce` are the realistic candidates.
If a lodash import shows up in a diff for `isEmpty`, `isEqual` or an `isX` predicate, the answer
is the type-check kernel, not the dependency.
