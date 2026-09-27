---
name: setup
description: Install or update the vincentius-marketplace kit (TV-STANDARD rules, skills, agents, hooks) into your Claude Code config.
disable-model-invocation: true
argument-hint: [--apply-settings] [--personal] [--with-mcp]
---

# Setup

The plugin cannot carry rules, so it carries this one skill, which runs the same installer the clone
route uses. Everything lands in `${CLAUDE_CONFIG_DIR:-$HOME/.claude}` as real files.

1. Show what would change: `node "${CLAUDE_PLUGIN_ROOT}/install.mjs" --dry-run`
2. Ask whether to go ahead, then run `node "${CLAUDE_PLUGIN_ROOT}/install.mjs"` with any flags given.
3. Hooks are only active once merged into `settings.json`. Offer `--apply-settings`: it writes a backup and prints
   the diff first. Never run it without a yes.
4. Report the installer's summary line as printed, and tell the user to restart Claude Code so the rules and
   hooks load.

Updating later: `/plugin marketplace update vincentius-marketplace`, then `/vincentius:setup` again.
Removing: `node "${CLAUDE_PLUGIN_ROOT}/install.mjs" --uninstall`, then uninstall the plugin.
