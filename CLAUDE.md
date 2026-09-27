# CLAUDE.md

vincentius-marketplace turns TV-STANDARD into Claude Code configuration: rules (a core that always
loads plus language packs that load by file type), skills, agents and hooks, plus vendored
third-party skills that keep a link to their upstream. `install.mjs` is the only thing that writes
into `~/.claude`.

## Stack

- Node 20+, no dependencies: `node:test` for tests, plain ES modules for scripts, CommonJS for hooks
- Claude Code rules, skills, agents, hooks and a plugin bootstrap

## Quick start

```bash
node install.mjs --dry-run     # what would be installed into ~/.claude (or $CLAUDE_CONFIG_DIR)
pnpm std:check                 # syntax, em-dashes, all tests; must pass before anything is done
pnpm test:unit
```

## Architecture

```
kit/          everything install.mjs copies: rules/tv, skills, agents, hooks/tv, settings, prompts, templates
vendor/       external items: pristine upstream at a pinned commit, patches, licence, vendor.json
bootstrap/    the plugin route's single setup skill
personal/     the author's own settings profile and CLAUDE.md; only --personal reads it
scripts/      std-check, vendor fetch/patch/check, notices, listing budget, shared file helpers
tests/        unit (hooks) and install (installer, vendoring) suites
docs/         ledger (source of truth for the build) and the documentation set
```

## Key principles

- IMPORTANT: `docs/ledger.md` is the source of truth for the build. Update it in the same commit as the work it records.
- IMPORTANT: tests never touch a real `~/.claude`; every install test sets `CLAUDE_CONFIG_DIR` to a temp dir.
- Hooks are CommonJS with no dependencies, deny via JSON on stdout, and fail open on malformed input.
- Hook sources are written with an editor, never through a Bash heredoc: heredocs strip backslashes.
- No em-dash character in code-adjacent files; write `\u2014` where code must match one.
- Vendored upstream files are never edited in place; changes are patch files in `vendor/<name>/patches/`.

## Comment and writing style

TV-STANDARD's: one line above the thing, explaining why. Box-drawing banners for sections in
scripts. Commits are conventional or carry the `[marketplace]` campaign tag.

## Where to look before asking

1. `docs/ledger.md`
2. `docs/rules.md` and `kit/rules/tv/`: the standard itself
3. `docs/` for how and why each part works
