---
name: tv-vendor-check
description: Check every vendored skill, binary and MCP server in vincentius-marketplace against its upstream, and bump one on request.
disable-model-invocation: true
argument-hint: [--bump <name>]
---

# Vendor check

The monthly upstream check. Read-only unless I ask for a bump.

## Steps

1. Read `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/vincentius-marketplace.installed.json` and take its `source`: the
   folder of the marketplace repo this kit was installed from.
2. Run `node "<source>/scripts/vendor-check.mjs"` and show the report as it prints.
3. For each item marked update-available, read the flagged changes with `gh api` compare before saying anything
   about them: new scripts, hooks, tool grants, URLs, reasoning or override phrasing.
4. Only when I name an item: `node "<source>/scripts/vendor-check.mjs" --bump <name>`. If its patches no longer
   apply, it stops and restores upstream; say which patch and why.
5. After a bump: read the diff of `vendor/<name>/upstream`, set `reviewed` in `vendor/vendor.json`, reinstall
   with `node "<source>/install.mjs"`, and propose the commit `chore(vendor): bump <name> to <short sha>`.

## Rules

- A candidate is at least 7 days old; never bump to anything newer.
- Binaries: verify the Authenticode signer and the release sha256, record both in `vendor.json`.
- Nothing is bumped without me asking for that item by name.
