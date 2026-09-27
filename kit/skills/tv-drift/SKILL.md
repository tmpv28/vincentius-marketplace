---
name: tv-drift
description: Report where a project has drifted from TV-STANDARD and from the template, without changing anything.
disable-model-invocation: true
---

# Drift report

AGENTS says: when the standard and the surrounding code disagree, the surrounding code wins and you
tell me about the drift instead of silently fixing it. This skill is the telling. It edits nothing.

## Steps

1. Read the project's `CLAUDE.md`, `package.json` and one file of each language present, so every relevant pack
   is loaded.
2. Compare against the template at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`:
   top-level `src/` folders, the typeChecks kernel, `commons/constants/shared.ts`, the response object system,
   the styles callers, the route table, the command vocabulary in `package.json`, `.husky/pre-commit`.
3. Scan the code for the tells in the core ("What I will notice immediately") and the rules that tooling cannot catch. Use Grep, then Read
   each hit before reporting it:
   - types named `I...`, `...Props`, or without the `Type` suffix
   - `index.ts` barrels and path aliases in `tsconfig.json` or `vite.config.*`
   - `enum`, `!value` emptiness checks, `JSON.stringify` equality
   - `@import`, hex or rgb literals and raw pixel breakpoints in component stylesheets
   - a committed `.env` with values (check with `git show HEAD:.env`, never by reading the working file)
   - em-dashes in code-adjacent text; `console.log`; commented-out code; `// TODO: handle error`
4. Check `CLAUDE.md` against the chapter 08 order and that it names the reference entity.

## Output

A table: where, what the project does, what the standard says (pack and TV chapter), and which side
looks stale. Then one line: the drift you would fix first, and why. Do not fix anything.
