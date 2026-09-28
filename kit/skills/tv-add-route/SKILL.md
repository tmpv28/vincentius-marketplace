---
name: tv-add-route
description: Use when adding or changing a route in a React + TypeScript project that follows TV-STANDARD (the route table is data; the router is generated from it).
argument-hint: <path> <PageName>
---

# Add a route

Routes are data: a URL definition and a route-table entry, never a hand-written `<Route>`.

## 1. Read the reference

Read, with the Read tool, `src/routes/router.tsx` and every file in `src/routes/modules/`, from the project or
else from the template at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.

## 2. Write it

- Add the URL to `baseRouteUrlsDefinition.ts`, keeping its existing grouping and naming.
- Add the entry to `routesConfigsDefinition.tsx`, pointing at the page. Guards (auth, permissions) go on the
  route, never in the page. The template's `RouteConfigType` has no guard field yet: the first route that
  needs one adds it to the type and to the router, and says so.
- If a new context provider is needed, it goes into the one explicit nesting in `router.tsx`, above every
  provider its defaults depend on, and the provider order in `CLAUDE.md` changes in the same commit.

## 3. Finish

`pnpm std:check` clean; the dev server resolves the path. Report the URL and the page it renders.
