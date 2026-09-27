---
name: tv-add-page
description: Use when adding a route-level page to a React + TypeScript project that follows TV-STANDARD (layout orchestration only, no mutations). Mirrors the project's reference page.
argument-hint: <Name> (the Page suffix is added)
---

# Add a page

A page orchestrates features and owns layout and detail reads. It never contains a mutation or a
business rule.

## 1. Read the reference

Read, with the Read tool, `src/pages/<Ref>Page/` in full and `src/routes/router.tsx`, from the project or
else from the template at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.

## 2. Write it

- `src/pages/<Name>Page.tsx`, flat, unless it has internals worth a folder; then `<Name>Page/` with `modules/`.
- Composition and layout only. Any mutation belongs in a feature the page renders; run `tv-add-feature` for it.
- A detail read lives here because the page is what the URL addressed; tri-state handled by the read
  controller's `defaultSystemRender`.
- Register it with `tv-add-route`.

## 3. Finish

`pnpm std:check` clean. Report which features it composes.
