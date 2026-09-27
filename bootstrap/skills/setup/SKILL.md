---
name: setup
description: Install, update or remove the vincentius-marketplace kit (TV-STANDARD rules, skills, agents, hooks) in your Claude Code config.
disable-model-invocation: true
argument-hint: [--apply-settings] [--uninstall]
---

# Setup

The plugin cannot carry rules, so it carries this one skill, which runs the same installer the clone
route uses. Everything lands in `${CLAUDE_CONFIG_DIR:-$HOME/.claude}` as real files. Needs Node 20+ and git.

1. Show what would change: `node "${CLAUDE_PLUGIN_ROOT}/install.mjs" --route=plugin --dry-run`
2. Ask whether to go ahead, then run `node "${CLAUDE_PLUGIN_ROOT}/install.mjs" --route=plugin`.
   If it reports conflicts, show them and stop: those files are the user's, and `--force` (which backs
   them up first) is theirs to choose.
3. Hooks stay off until they are merged into `settings.json`. Show that change first with
   `node "${CLAUDE_PLUGIN_ROOT}/install.mjs" --route=plugin --dry-run --apply-settings`, ask, and only on a
   yes run it again without `--dry-run`. It backs up `settings.json` before writing.
4. Report the installer's summary line as printed, and tell the user to restart Claude Code so the rules and
   hooks load.

Updating later: `/plugin marketplace update vincentius-marketplace`, then `/vincentius:setup` again. Files
you edited are backed up (`<file>.bak-<time>`) before the update replaces them.

Removing (`$ARGUMENTS` contains `--uninstall`): show `node "${CLAUDE_PLUGIN_ROOT}/install.mjs" --uninstall --dry-run`,
ask, run it without `--dry-run`, then tell the user to run `/plugin uninstall vincentius@vincentius-marketplace`.
The uninstall removes the kit's files and its hooks from `settings.json`, and keeps a backup of anything edited.
