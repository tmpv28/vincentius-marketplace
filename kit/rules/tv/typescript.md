---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
---

# TV-STANDARD: TypeScript

TV-PACK: typescript

Loaded in full because a TypeScript file was read. "TV NN" names the original chapter; docs/rules.md maps each chapter to its packs.
Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.

---

<!-- from standards/02-naming.md -->

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

## `strict`, always (TV 03)

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
  often referenced above their definition inside a `modules/` barrel of related checks.
- Named exports by default. Default export only for a component, feature, page, or a controller
  hook, where the file **is** the thing.
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

<!-- from standards/06-api-layer.md -->

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

<!-- from standards/10-tooling-and-checks.md -->

## No path aliases (TV 10)

`resolve.alias` is empty, `tsconfig.paths` is empty. Imports are deep and relative.

Aliases hide how far away something is. `../../../../` is a design smell you can see from across
the room, and `@/commons/...` is the same smell with the smell removed.
