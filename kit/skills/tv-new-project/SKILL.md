---
name: tv-new-project
description: Scaffold a new React + TypeScript project from the TV-STANDARD template and work through the new-project checklist box by box.
disable-model-invocation: true
argument-hint: <project-folder> [one line on what it is]
---

# New project

Creates a project from the TV-STANDARD template and works through `checklist.md` (in this skill's
folder) top to bottom. Nothing in the checklist is optional. Report each box as done, with the
evidence, or as blocked, with the reason.

## Steps

1. Read `checklist.md` in full before starting.
2. Read the template's `CLAUDE.md`, `package.json`, `src/App.tsx` and one feature under
   `src/features/Notes/`, so the react, typescript and node-tooling packs are loaded before anything is written.
   The template lives at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.
3. Copy the template to the target folder, excluding `node_modules`, `dist`, `coverage` and `storybook-static`.
4. Set `name` and `description` in `package.json` (`"React with TypeScript | <one line>"`), the `<title>` in
   `index.html`, and ask me for the accent colour before changing `scripts/branding.js` and
   `src/resources/styles/variables/colors/_colorStatics.scss`.
5. `git init -b main`. Seed the local environment with exactly `cp .env .env.local`, then tell me which names
   in `.env.local` need values. Never read or write the values yourself.
6. `pnpm install`. The 7-day minimum release age applies; if an install is refused for age, say which package.
7. `pnpm std:check` must pass on the untouched copy before anything else.
8. Break something on purpose, try to commit, confirm the hook refuses it, then undo the break.
9. The first commit is `chore: scaffold project` and contains only the scaffold. Make it only if I asked for
   commits as part of this run; otherwise stop and say it is ready to commit.
10. Work through the remaining checklist sections (documentation, skeleton, first vertical slice, before calling
    it set up), using `tv-add-entity` for the first vertical slice.

## Gotchas

- The seed copy is the only way `.env.local` gets created: the guard blocks reading any untracked `.env*` file.
- Windows: run the dev server and Storybook from PowerShell or Git Bash; both are fine, but paths in scripts
  must stay forward-slash.
- A project that is not React: use the framework's official scaffolder, then apply the core and the packs that
  match its files. Never hand-write a manifest.
