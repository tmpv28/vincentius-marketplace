---
name: tv-add-component
description: Use when adding a shared UI component to a React + TypeScript project that follows TV-STANDARD (commons/components, zero domain knowledge). Mirrors the project's reference components.
argument-hint: <Name> (the Component suffix is added)
---

# Add a shared component

A component in `src/commons/components/<Name>Component/` that knows nothing about the domain. Search
first: if something close exists, extend it instead (TV 00 #1).

## 1. Search, then read the reference

- Grep `src/commons/components/` for a component that already does most of this. If one exists, stop and say
  which, and how you would extend it.
- Read, with the Read tool, `ButtonComponent/` (single DOM part) and `InputComponent/` (several parts), each file
  including `modules/` and the story, from the project or else from the template at
  `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.

## 2. Write it

- `<Name>Component.tsx`, `<Name>Component.scss` with a PascalCase BEM block of the same name, `modules/types.ts`
  (`<Name>ComponentType`), `modules/constants.ts` when there are constants.
- The fixed escape hatches: `customClassNames` (map mirroring the DOM parts, `rootContainer` outermost),
  `customClassName` only for a single-element component, `styleConfigs`.
- Loading, empty and error handled inside the component as props, never branched at call sites.
- Accessible: keyboard reachable, visible focus, an accessible name; a disabled control carries its reason.
- A story only when the component has variants worth seeing side by side.

## 3. Finish

`pnpm std:check` clean. Report the props and why each is optional or required.
