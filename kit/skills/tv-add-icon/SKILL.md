---
name: tv-add-icon
description: Use when adding an SVG icon to a React + TypeScript project that follows TV-STANDARD (kebab-case file, imported as a component through svgr).
argument-hint: <kebab-name> <svg source>
---

# Add an icon

## 1. Read first

Read, with the Read tool, `vite.config.ts` (the svgr setup), `src/resources/styles/variables/colors/_colorStatics.scss`,
and any existing icon folder and its registry (a `*Definition` file under `src/resources/`), from the project or
else from the template at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.

## 2. Write it

- The file is kebab-case: `src/resources/icons/<name>.svg`. Search first; an icon that already exists is extended
  or reused, not added twice.
- Strip fixed colours from the SVG: `fill` and `stroke` become `currentColor`, so the colour comes from a
  `.color_x` class or the parent. No hex anywhere.
- Import it where used as a component through svgr (`?react`). If the project keeps an icon registry
  (`...Definition`), add it there instead of importing ad hoc; do not create a registry for one icon.
- An icon-only button that uses it gets an `aria-label`.

## 3. Finish

`pnpm std:check` clean. Report the file and where it is used.
