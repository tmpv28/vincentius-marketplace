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
4. Only when I name an item: `node "<source>/scripts/vendor-check.mjs" --bump <name>`. It refuses while the report
   has flags for that item; add `--accept-flags` only after I have read them and said yes. If its patches no
   longer apply, it stops and restores upstream; say which patch and why.
5. After a bump: read the diff of `vendor/<name>/upstream`. A bump clears `reviewed` in `vendor/vendor.json`, and the installer
   refuses a skill until it is set again; set it to today's date only once the diff is read. A binary is not
   checked by the installer: record its signer before setting `reviewed`. Then reinstall with
   `node "<source>/install.mjs"`, run `node "<source>/scripts/notices.mjs"`, and propose the commit
   `chore(vendor): bump <name> to <short sha>` with a body that says why and which flags were reviewed.
   A binary bump (`impeccable-engine`) also needs impeccable's `002-pin-engine-sha256.patch` regenerated with
   the new `assetSha256` values (`vendor-patch.mjs start impeccable 002-pin-engine-sha256.patch`, edit both
   launchers, `save`); until then the launcher refuses the new engine and the integrity test names the mismatch.

## Rules

- A candidate is at least 7 days old; never bump to anything newer.
- Binaries: verify the Authenticode signer and the release sha256, record both in `vendor.json`.
- Nothing is bumped without me asking for that item by name.
