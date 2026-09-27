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
| 4 | Vendor everything | done | tag hold/phase-4 | 9 skills vendored at confirmed pins, 9 patches, engine verified; vendor-check live |
| 5 | Build the tooling | done | tag hold/phase-5 | install.mjs, plugin bootstrap, 11 tv skills, 2 agents, 5 hooks, vendor-check, listing budget; 109 unit + install tests |
| 6 | Review until clean | in progress | see git log | pass 1: six reviews (rules, TV conformance, hooks, installer, vendoring, security); all blocking and recommended findings fixed |
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
- AGENTS "tells" table went to react.md at first; moved to core in Phase 6 (see Corrections).
- Drift settled: 04 fence and missing heading; 08 `.claude/memory/` replaced by auto memory; template
  CLAUDE.md (ESLint line, four-file contexts, classNames object, staircase as preference, real paths,
  test:unit); template std:check gained the em-dash gate (D7); `.impeccable/` ignored.
- Checklists moved into `kit/skills/tv-pre-pr/` and `kit/skills/tv-new-project/` with history.

## Phase 4 notes

- Pins confirmed on GitHub, all dated on or before 2026-09-20; no published advisories reach any pin.
- Engine engine-v0.1.5: sha256 477e544f...b531c71 matches the release; Authenticode Valid, signer "Renaissance Geek, Inc.",
  the publisher that upstream release-engine.yml enforces. Installed at ~/.impeccable/bin/engine-v0.1.5/, IMPECCABLE_BIN set,
  so the launcher never downloads. It reports version 4.0.0 (the CLI version string); T-X1 confirms it works.
- Security read found and patched: impeccable (unpinned npx, "do not ask permission", sandbox-evasion advice,
  CLAUDE_PLUGIN_ROOT in agents); taste (npm/yarn/@latest, forced image tool, TV precedence note); vercel (npx svgo);
  swiftui (SKILL_DIR is not a Claude Code variable). systematic-debugging eval prompts excluded from installs.
- Kept impeccable at the tagged skill-v4.3.1 although untagged 0a4e72a (2026-09-15) is eligible: it changes
  live-browser.js and has not been read. First item for the monthly check.
- vendor-check fixed twice while writing: same-day commits compared by timestamp; releases and advisories by version.

## Phase 5 notes

- Template: unused `lodash`, `@types/lodash` and `@testing-library/react` removed (TV 03, TV 09); template std:check passes.
- Listing today (this machine, 2% budget): 80 invocable skills, ~7k tokens; the kit adds 13 skills, ~1k tokens.
- `claude plugin validate .` passes for the marketplace manifest.
- The final ask rules (git push, pnpm add/install/update/dlx, npm, npx) live in `personal/settings.snippet.json`;
  they are applied at the very end of Phase 10, after the last push.

## Corrections

Recorded as they happen, in the shape: what was wrong, what was checked, what is true.

- vendor-patch start built its work copy inside the repo, where `git apply` resolves paths against the repo root
  and skips unmatched files with exit 0. The taste skill's second patch was recorded against a base without the first
  and deleted the manual-only line. buildItem now always patches outside any repo and fails unless every file
  in a patch reports "Applied". Patch 002 regenerated; every item verified.
- The guard as planned (v6) blocked creating a new `.env` file, which `tv-new-project` and fixture F6
  need. Writing a file that does not exist cannot expose a secret, so `Write` to a missing path is
  now allowed. 56 cases pass.
- Phase 6 rules review: TV 01 anatomy, TV 02 suffix/casing/handler/hook/API_ naming, TV 05 contexts and
  TV 06 API layer sat in react.md (tsx, jsx) but govern .ts files, so they never loaded for a .ts-only
  change. Checked: the packs had not been hand-edited since generation. Now: the migration was re-run
  from 28113e9 with a corrected map (01, 05, 06 and the naming sections to typescript; the casing table
  and the tells table to core; "No path aliases" to node-tooling; more tooling config paths), stale
  paths into the old repo relabelled, the contract states that only reading a file loads its pack and
  that no pack overrides TV 00, and docs/rules.md is generated. Verbatim check: every source line of a
  kept section is present; the 50 absent lines are dropped sections, relabels or the two drift fixes.

## Phase 6 notes

- Pass 1 reviewers: rules split, TV conformance, hooks and scripts, installer and plugin route, vendoring,
  security. Fixes landed in four commits (rules, installer, hooks, vendoring).
- Installer: sha256 per file in the manifest; edited or taken-over files are backed up; uninstall removes
  the kit hooks and status line from settings.json and prunes empty folders; one spelling per config dir;
  hooks replaced one by one inside groups; --route=plugin; preflight (Node 20, git); temp builds cleaned;
  scripts chmod 755 by shebang. plugin.json has no version, so each commit is a new plugin version.
- personal.snippet.json moved to personal/ (author only); pnpm run/test and NotebookEdit left its allow list.
- The guard is an accident guard, not an adversary guard (stated in its header). The Stop gate runs only a
  repo's own `node scripts/<file>` std:check, with node directly: no shell, no pnpm, no pre-scripts.
- Vendoring: verifyItem refuses unreviewed items and any upstream whose sha256 differs from the reviewed
  copy; line endings verbatim; executables recorded; notices generated and checked by std-check; the
  impeccable engine is pinned per platform in the launcher (patch 002). A binary bump needs 002 regenerated.
- Accepted and documented rather than fixed: upstreamSha256 does not cover patches or licences (a git diff
  shows those); an engine reached through IMPECCABLE_BIN or PATH runs unhashed (upstream's model);
  `cat .*` is not denied; a commit nested inside `bash -c` is not checked.
