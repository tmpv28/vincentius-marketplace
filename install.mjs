#!/usr/bin/env node
// The only thing that writes into ~/.claude (or $CLAUDE_CONFIG_DIR). Copies real files, never links:
// path-scoped rules are not guaranteed to load through a link that points outside the project.
//
//   node install.mjs [--dry-run] [--personal] [--apply-settings] [--with-mcp] [--force]
//   node install.mjs --uninstall [--dry-run]
//
// Everything it writes is recorded in <target>/vincentius-marketplace.installed.json. An update removes
// what left the kit; --uninstall removes exactly what the manifest lists; a file the kit does not own
// is never overwritten (use --force to take it over).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { readVendor, buildItem } from "./scripts/vendor-lib.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const KIT = join(ROOT, "kit");
const args = new Set(process.argv.slice(2));
const flag = (name) => args.has(`--${name}`);
const TARGET = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const MANIFEST = join(TARGET, "vincentius-marketplace.installed.json");
const DRY = flag("dry-run");
const toPosix = (p) => p.split(sep).join("/");
const TARGET_POSIX = toPosix(TARGET);
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const ROUTE = process.env.CLAUDE_PLUGIN_ROOT ? "plugin" : "clone";

const log = (icon, text) => console.log(`${icon}  ${text}`);
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};
const sameContent = (a, b) => existsSync(b) && readFileSync(a).equals(readFileSync(b));
const readManifest = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null);

// ─── Plan: every file the kit wants, as [source, relative target] ──
const plan = () => {
  const files = [];
  const add = (src, rel) => files.push([src, toPosix(rel)]);
  const addTree = (srcDir, relDir, skip = () => false) => {
    for (const file of walk(srcDir)) {
      const rel = relative(srcDir, file);
      if (!skip(toPosix(rel))) add(file, join(relDir, rel));
    }
  };

  addTree(join(KIT, "rules"), "rules");
  addTree(join(KIT, "skills"), "skills");
  addTree(join(KIT, "hooks"), "hooks");
  addTree(join(KIT, "prompts"), "prompts");
  addTree(join(KIT, "agents"), "agents");
  if (existsSync(join(KIT, "statusline.js"))) add(join(KIT, "statusline.js"), "statusline.js");
  const ignoredTemplate = (rel) => /(^|\/)(node_modules|dist|coverage|storybook-static)(\/|$)/.test(rel) || /(^|\/)\.env\.local$/.test(rel);
  addTree(join(KIT, "templates"), "templates", ignoredTemplate);

  // Vendored skills and agents, rebuilt from pristine upstream plus patches on every install.
  for (const [name, entry] of Object.entries(readVendor())) {
    if (entry.kind !== "skill") continue;
    const built = buildItem(name, entry);
    const excluded = new Set(entry.exclude || []);
    if (entry.install.skill) addTree(join(built, "skill"), entry.install.skill, (rel) => excluded.has(rel));
    if (entry.install.agents) addTree(join(built, "agents"), entry.install.agents);
  }
  return files;
};

// Agent sources may inline another kit file, so a checklist has one home and the agent still gets all of it.
const render = (src) => {
  const text = readFileSync(src);
  if (!src.endsWith(".md")) return text;
  const expanded = text.toString("utf8").replace(/\{\{include:([^}]+)\}\}/g, (_, rel) => readFileSync(join(ROOT, rel.trim()), "utf8").trim());
  return Buffer.from(expanded, "utf8");
};

// ─── Uninstall ──────────────────────────────────────────────
const uninstall = () => {
  const manifest = readManifest();
  if (!manifest) { log("✔", `nothing installed in ${TARGET}`); return 0; }
  for (const rel of manifest.files) {
    const path = join(TARGET, rel);
    if (!existsSync(path)) continue;
    if (!DRY) rmSync(path);
    log("-", rel);
  }
  if (!DRY) rmSync(MANIFEST);
  log("✔", `${DRY ? "would remove" : "removed"} ${manifest.files.length} files; nothing else touched`);
  return 0;
};

// ─── Settings merge (only with --apply-settings) ─────────────
const snippet = (name) => {
  const path = join(KIT, "settings", name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8").split("{{CLAUDE_DIR}}").join(TARGET_POSIX)) : null;
};
const hookKey = (hook) => [hook.command, ...(hook.args || [])].join(" ");

export const mergeSettings = (current, addition) => {
  const next = JSON.parse(JSON.stringify(current));
  for (const [event, entries] of Object.entries(addition.hooks || {})) {
    next.hooks = next.hooks || {};
    const existing = next.hooks[event] || [];
    for (const entry of entries) {
      const keys = entry.hooks.map(hookKey);
      // Same command path means the same hook: replace it, so an update never duplicates it.
      const kept = existing.filter((e) => !(e.hooks || []).some((h) => keys.includes(hookKey(h))));
      existing.length = 0;
      existing.push(...kept, entry);
    }
    next.hooks[event] = existing;
  }
  for (const list of ["allow", "ask", "deny"]) {
    const wanted = addition.permissions?.[list];
    if (!wanted) continue;
    next.permissions = next.permissions || {};
    next.permissions[list] = [...new Set([...(next.permissions[list] || []), ...wanted])];
  }
  for (const [key, value] of Object.entries(addition)) {
    if (key === "hooks" || key === "permissions") continue;
    if (key === "env") next.env = { ...(value || {}), ...(next.env || {}) };
    else if (!(key in next)) next[key] = value;
  }
  return next;
};

const applySettings = () => {
  const path = join(TARGET, "settings.json");
  const current = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  let next = mergeSettings(current, snippet("hooks.snippet.json"));
  if (flag("personal") && snippet("personal.snippet.json")) next = mergeSettings(next, snippet("personal.snippet.json"));
  const before = JSON.stringify(current, null, 2);
  const after = JSON.stringify(next, null, 2);
  if (before === after) { log("✔", "settings.json already has everything; not written"); return; }
  const oldLines = new Set(before.split("\n"));
  for (const line of after.split("\n")) if (!oldLines.has(line)) console.log(`   + ${line.trim()}`);
  if (DRY) { log("·", "dry run: settings.json not written"); return; }
  if (existsSync(path)) {
    const backup = `${path}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(path, backup);
    log("✔", `backup: ${toPosix(backup)}`);
  }
  writeFileSync(path, after + "\n");
  log("✔", "settings.json merged");
};

// ─── Install ────────────────────────────────────────────────
const install = () => {
  const previous = readManifest();
  const owned = new Set(previous?.files || []);
  if (previous && previous.route !== ROUTE)
    log("!", `previously installed by the ${previous.route} route; this run (${ROUTE}) takes over the same files`);

  const files = plan();
  const seen = new Set();
  let written = 0, unchanged = 0;
  const conflicts = [];
  for (const [src, rel] of files) {
    if (seen.has(rel)) throw new Error(`two kit sources want ${rel}`);
    seen.add(rel);
    const dest = join(TARGET, rel);
    const content = render(src);
    if (existsSync(dest) && readFileSync(dest).equals(content)) { unchanged++; continue; }
    if (existsSync(dest) && !owned.has(rel) && !flag("force")) { conflicts.push(rel); continue; }
    if (!DRY) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, content); }
    written++;
    if (DRY) log("+", rel);
  }

  // Files the kit owned last time and no longer ships.
  const stale = [...owned].filter((rel) => !seen.has(rel));
  for (const rel of stale) {
    if (!DRY && existsSync(join(TARGET, rel))) rmSync(join(TARGET, rel));
    log("-", `${rel} (left the kit)`);
  }

  // Personal CLAUDE.md never overwrites yours: it lands beside it for you to merge.
  if (flag("personal") && existsSync(join(ROOT, "personal", "CLAUDE.md"))) {
    const mine = join(TARGET, "CLAUDE.md");
    const proposed = join(ROOT, "personal", "CLAUDE.md");
    if (!existsSync(mine)) { if (!DRY) copyFileSync(proposed, mine); log("+", "CLAUDE.md (personal)"); }
    else if (!sameContent(proposed, mine)) {
      if (!DRY) copyFileSync(proposed, join(TARGET, "CLAUDE.md.from-kit"));
      log("!", "CLAUDE.md exists and differs; the kit's version is in CLAUDE.md.from-kit");
    }
  }

  const manifestFiles = [...seen].filter((rel) => !conflicts.includes(rel)).sort();
  if (!DRY) writeFileSync(MANIFEST, JSON.stringify({ name: "vincentius-marketplace", version: VERSION, route: ROUTE,
    source: toPosix(ROOT), installedAt: new Date().toISOString(), files: manifestFiles }, null, 2) + "\n");

  for (const rel of conflicts) log("✖", `${rel} exists and is not the kit's; left untouched (--force takes it over)`);
  log(conflicts.length ? "!" : "✔",
    `${DRY ? "dry run: would write" : "wrote"} ${written}, unchanged ${unchanged}, removed ${stale.length}, conflicts ${conflicts.length} → ${TARGET_POSIX}`);

  if (flag("apply-settings")) applySettings();
  else log("·", "settings.json untouched; run with --apply-settings to merge the hooks (backup and diff first)");

  if (flag("with-mcp")) {
    const mcp = readVendor()["chrome-devtools-mcp"];
    if (DRY) log("·", `would run: ${mcp.install.command}`);
    else {
      const result = spawnSync(mcp.install.command, { shell: true, encoding: "utf8", env: { ...process.env, ...mcp.install.env } });
      log(result.status === 0 ? "✔" : "✖", `chrome-devtools MCP: ${(result.stdout + result.stderr).trim().split("\n").pop()}`);
    }
  }
  return conflicts.length ? 1 : 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1]?.endsWith("install.mjs")) {
  try {
    process.exit(flag("uninstall") ? uninstall() : install());
  } catch (error) {
    log("✖", error.message);
    process.exit(1);
  }
}
