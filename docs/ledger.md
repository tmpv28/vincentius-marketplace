# Ledger

The source of truth for the build of this repository. Not the chat, not memory: this file.
Each phase ends with a commit, a push and a `hold/phase-N` tag. A run that stops resumes from the
first phase not marked done.

Plan of record: https://claude.ai/artifact/HMPidXfpRgeXUyL4h91G63 (v6.2).

---

## Phases

| Phase | Name | State | Commits | Notes |
| --- | --- | --- | --- | --- |
| 0 | Harden this machine | done | n/a (machine config) | see Phase 0 notes |
| 1 | Local clean-up | done | n/a (machine config) | see Phase 1 notes |
| 2 | Create the repo | done | see git log, tag hold/phase-2 | TV history under standard/ (10 commits); hooks + 85 unit tests moved in |
| 3 | Split the standard | done | tag hold/phase-3 | core 12.9k tok; typescript 5.4k; react 13.1k; accessibility 0.6k; styles 1.4k; scss 1.4k; testing 1.8k; node-tooling 2.8k (chars/4). 175 sections, 2440 lines verified verbatim |
| 4 | Vendor everything | pending | | |
| 5 | Build the tooling | pending | | |
| 6 | Review until clean | pending | | |
| 7 | Test everything | pending | | |
| 8 | Write the documentation | pending | | |
| 9 | Install here and migrate | pending | | |
| 10 | Release and retire | pending | | |

---

## Phase 0 notes

- Backups: `~/.claude/backups/pre-marketplace-2026-09-27/` (settings.json, CLAUDE.md).
- Applied: narrow allow list; deny list keeps the 13 original rules, `git push --force*` narrowed to
  `--force` and `--force <args>` so `--force-with-lease` stays possible; secret-path denies added.
  `enableAllProjectMcpServers: false`, `autoUpdatesChannel: "stable"`, `modelSettings` removed,
  `skillListingBudgetFraction: 0.02`, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2`, `C:\tmp` fixed.
- Guard installed at `~/.claude/hooks/tv/guard.js` (56 cases pass from that path) plus the
  Notification hook. `pnpm config set minimumReleaseAge 10080 --location=global`.
- Deferred to Phase 10, by design: the `ask` rules on `git push` and on `pnpm add/install/update/dlx`,
  `npm`, `npx`. This session loads settings from the home folder, so a repo-level allow cannot
  exempt the unattended run; applying them now would stall it.
- Not changed: the Proactive output style you chose; `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (kept, D12).

## Phase 1 notes

- Disabled: ruby, csharp, gopls, rust-analyzer, jdtls, pyright LSP plugins;
  `figma@claude-plugins-official` (the claude.ai copy stays); `github@claude-plugins-official`.
- Installed: `typescript-language-server@6.0.0` and `typescript` via pnpm (6.0.1 was under 7 days),
  LLVM 23.1.1 via winget for clangd (23.1.2 was under 7 days). Advisories checked: none.
- PATH: `pnpm setup` prepended `%PNPM_HOME%\bin`, whose `pnpm.exe` is a broken stale v11 shim.
  Moved it to the end of the user PATH so corepack's pnpm wins; `C:\Program Files\LLVM\bin` added.
  Claude Code needs a restart to see both language servers.
- Plugin MCP connectors stay as they are: unauthenticated ones expose no tools; disabling them
  individually needs the interactive `/mcp` screen.

---

## Phase 3 notes

- Planned `css.md` and `html.md` became `styles.md` (scss + css) and `accessibility.md` (tsx, jsx, html, vue,
  svelte): each section can live in exactly one file, and both HTML and React files need the
  accessibility rules, both SCSS and CSS the language-free styling rules.
- AGENTS "tells" table went to react.md: every row is a React/TypeScript/SCSS tell.
- Drift settled: 04 fence and missing heading; 08 `.claude/memory/` replaced by auto memory; template
  CLAUDE.md (ESLint line, four-file contexts, classNames object, staircase as preference, real paths,
  test:unit); template std:check gained the em-dash gate (D7); `.impeccable/` ignored.
- Checklists moved into `kit/skills/tv-pre-pr/` and `kit/skills/tv-new-project/` with history.

## Corrections

Recorded as they happen, in the shape: what was wrong, what was checked, what is true.

- The guard as planned (v6) blocked creating a new `.env` file, which `tv-new-project` and fixture F6
  need. Writing a file that does not exist cannot expose a secret, so `Write` to a missing path is
  now allowed. 56 cases pass.
