# 05 — State and contexts

## No state library

React Context and `useState`. No Redux, no Zustand, no Jotai, no React Query.

This is a real decision with a real cost, and I take it deliberately. A state library buys
devtools, middleware and a community of patterns. It costs a dependency, a mental model everyone
has to learn, and a very strong gravitational pull toward putting things in global state that
have no business being there. In the projects I build, the trade goes the other way.

The consequence I accept: I have to be disciplined about re-renders myself. That is what the
state/actions split, the memoised provider value and the compare-before-write guard are for.

---

## The four-file context

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

---

## The accessor hook

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

---

## Default values are real

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

---

## Split state from actions

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

---

## Refs for "current at call time, stable by identity"

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

---

## Decompose large contexts into controllers

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

---

## Composition site

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

---

## Local state

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
