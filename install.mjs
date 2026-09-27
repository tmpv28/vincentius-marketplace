#!/usr/bin/env node
// The only thing that writes into ~/.claude (or $CLAUDE_CONFIG_DIR). Copies real files, never links:
// path-scoped rules are not guaranteed to load through a link that points outside the project.
//
//   node install.mjs [--dry-run] [--apply-settings] [--force] [--route=plugin]
//   node install.mjs --uninstall [--dry-run]
//   Author's own machine only: [--personal] [--with-mcp]
//
// Everything it writes is recorded, with its sha256, in <target>/vincentius-marketplace.installed.json.
// A file the kit does not own is never overwritten (--force takes it over, after a backup). A kit file
// you edited is backed up before an update replaces it or an uninstall removes it.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, renameSync, chmodSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { readVendor, buildItem, verifyItem } from "./scripts/vendor-lib.mjs";
import { toPosix, sha256, walk, pruneEmptyDirs } from "./scripts/files.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const KIT = join(ROOT, "kit");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

// One spelling per directory: a trailing slash, a relative path or a lower-case drive letter would
// otherwise produce hook commands that never match the ones already merged, and every hook would run twice.
const normaliseDir = (dir) => resolve(dir).replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const TARGET = normaliseDir(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"));
const TARGET_POSIX = toPosix(TARGET);
const MANIFEST = join(TARGET, "vincentius-marketplace.installed.json");
const SETTINGS = join(TARGET, "settings.json");
const DRY = flag("dry-run");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
// The plugin's setup skill passes --route=plugin; a copy inside the plugin cache is the plugin route too.
const ROUTE = option("route") || (/\/plugins\/cache\//.test(toPosix(ROOT)) ? "plugin" : "clone");
const IS_WINDOWS = process.platform === "win32";
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const log = (icon, text) => console.log(`${icon}  ${text}`);
const readManifest = () => {
  if (!existsSync(MANIFEST)) return null;
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  // Manifests before 0.2 listed files without hashes: treat every one as unedited.
  if (Array.isArray(manifest.files)) manifest.files = Object.fromEntries(manifest.files.map((rel) => [rel, null]));
  return manifest;
};
const writeManifest = (manifest) => {
  const temp = `${MANIFEST}.tmp`;
  writeFileSync(temp, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(temp, MANIFEST);
};
const backup = (path) => {
  const copy = `${path}.bak-${STAMP}`;
  if (!DRY) copyFileSync(path, copy);
  return toPosix(relative(TARGET, copy));
};
const isEditedSince = (path, recordedHash) => Boolean(recordedHash) && sha256(readFileSync(path)) !== recordedHash;

// ─── Preflight ──────────────────────────────────────────────
const preflight = () => {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) throw new Error(`Node 20 or newer is needed; this is ${process.versions.node}`);
  const git = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (git.error || git.status !== 0) throw new Error("git is needed on PATH: vendored skills are rebuilt with git apply");
  if (flag("personal") && !IS_WINDOWS) log("!", "--personal is the author's Windows profile; its PowerShell notification will not work here");
};

// ─── Plan: every file the kit wants, as [source, relative target] ──
const plan = () => {
  const files = [];
  const buildDirs = [];
  const addTree = (srcDir, relDir, isSkipped = () => false) => {
    for (const file of walk(srcDir)) {
      const rel = toPosix(relative(srcDir, file));
      if (!isSkipped(rel)) files.push([file, toPosix(join(relDir, rel))]);
    }
  };

  addTree(join(KIT, "rules"), "rules");
  addTree(join(KIT, "skills"), "skills");
  addTree(join(KIT, "hooks"), "hooks");
  addTree(join(KIT, "prompts"), "prompts");
  addTree(join(KIT, "agents"), "agents");
  files.push([join(KIT, "statusline.js"), "statusline.js"]);
  const isTemplateNoise = (rel) => /(^|\/)(node_modules|dist|coverage|storybook-static)(\/|$)/.test(rel) || /(^|\/)\.env\.local$/.test(rel);
  addTree(join(KIT, "templates"), "templates", isTemplateNoise);

  // Vendored skills and agents, rebuilt from their verified upstream plus patches on every install.
  for (const [name, entry] of Object.entries(readVendor())) {
    if (entry.kind !== "skill") continue;
    verifyItem(name, entry);
    const built = buildItem(name, entry);
    buildDirs.push(built);
    const excluded = new Set(entry.exclude || []);
    if (entry.install.skill) addTree(join(built, "skill"), entry.install.skill, (rel) => excluded.has(rel));
    if (entry.install.agents) addTree(join(built, "agents"), entry.install.agents);
  }
  const cleanup = () => { for (const dir of buildDirs) rmSync(dir, { recursive: true, force: true }); };
  return { files, cleanup };
};

// Agent sources may inline another kit file, so a checklist has one home and the agent still gets all of it.
const render = (src) => {
  const text = readFileSync(src);
  if (!src.endsWith(".md")) return text;
  const expanded = text.toString("utf8").replace(/\{\{include:([^}]+)\}\}/g, (_, rel) => readFileSync(join(ROOT, rel.trim()), "utf8").trim());
  return Buffer.from(expanded, "utf8");
};

// Git on Windows drops the executable bit, so a script is recognised by its shebang instead.
const writeKitFile = (dest, content) => {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  if (!IS_WINDOWS && content.subarray(0, 2).toString() === "#!") chmodSync(dest, 0o755);
};

// Removes a kit file; one you edited is kept as a backup first. Returns the backup's name, if any.
const removeKitFile = (rel, recordedHash) => {
  const path = join(TARGET, rel);
  if (!existsSync(path)) return null;
  const kept = isEditedSince(path, recordedHash) ? backup(path) : null;
  if (!DRY) { rmSync(path); pruneEmptyDirs(dirname(path), TARGET); }
  return kept;
};

// ─── Settings ───────────────────────────────────────────────
const snippet = (path) => existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8").split("{{CLAUDE_DIR}}").join(TARGET_POSIX).split("{{SOURCE}}").join(toPosix(ROOT)))
  : null;

// A kit hook is known by its script name under hooks/tv/, whatever directory spelling it was merged with.
// Any other hook is known by its full command.
const hookId = (hook) => {
  const command = [hook.command, ...(hook.args || [])].join(" ").split("\\").join("/");
  const kitScript = command.match(/\/hooks\/tv\/([\w-]+\.js)/);
  return kitScript ? `kit:${kitScript[1]}` : `cmd:${command}`;
};
const isKitHook = (hook) => hookId(hook).startsWith("kit:");

// Drops matching hooks from their groups, never whole groups: a hook you added beside a kit hook stays.
const withoutHooks = (groups, isDropped) => groups
  .map((group) => ({ ...group, hooks: (group.hooks || []).filter((hook) => !isDropped(hook)) }))
  .filter((group) => group.hooks.length > 0);

// Returns the merged settings and the keys where yours were kept over the kit's.
export const mergeSettings = (current, addition, { kitStatusLine = null } = {}) => {
  const next = JSON.parse(JSON.stringify(current));
  const kept = [];
  for (const [event, groups] of Object.entries(addition.hooks || {})) {
    next.hooks = next.hooks || {};
    const incoming = new Set(groups.flatMap((group) => group.hooks.map(hookId)));
    next.hooks[event] = [...withoutHooks(next.hooks[event] || [], (hook) => incoming.has(hookId(hook))), ...groups];
  }
  for (const list of ["allow", "ask", "deny"]) {
    const wanted = addition.permissions?.[list];
    if (!wanted) continue;
    next.permissions = next.permissions || {};
    next.permissions[list] = [...new Set([...(next.permissions[list] || []), ...wanted])];
  }
  for (const [key, value] of Object.entries(addition)) {
    if (key === "hooks" || key === "permissions") continue;
    if (key === "env") {
      for (const name of Object.keys(value)) if (next.env && name in next.env && next.env[name] !== value[name]) kept.push(`env.${name}`);
      next.env = { ...value, ...(next.env || {}) };
    }
    // The status line the kit set last time is the kit's to refresh; any other one is yours.
    else if (key === "statusLine" && next.statusLine && kitStatusLine && next.statusLine.command === kitStatusLine) next.statusLine = value;
    else if (!(key in next)) next[key] = value;
    else if (JSON.stringify(next[key]) !== JSON.stringify(value)) kept.push(key);
  }
  return { settings: next, kept };
};

// Removes the kit's hooks and, if it is still the kit's, the status line.
export const unmergeSettings = (current, { kitStatusLine = null } = {}) => {
  const next = JSON.parse(JSON.stringify(current));
  for (const event of Object.keys(next.hooks || {})) {
    next.hooks[event] = withoutHooks(next.hooks[event], isKitHook);
    if (next.hooks[event].length === 0) delete next.hooks[event];
  }
  if (next.hooks && Object.keys(next.hooks).length === 0) delete next.hooks;
  if (kitStatusLine && next.statusLine?.command === kitStatusLine) delete next.statusLine;
  return next;
};

// Shows the change, then writes it after a backup. Returns false when there was nothing to write.
const writeSettings = (current, next) => {
  const before = JSON.stringify(current, null, 2);
  const after = JSON.stringify(next, null, 2);
  if (before === after) return false;
  const oldLines = new Set(before.split("\n"));
  const newLines = new Set(after.split("\n"));
  for (const line of before.split("\n")) if (!newLines.has(line)) console.log(`   - ${line.trim()}`);
  for (const line of after.split("\n")) if (!oldLines.has(line)) console.log(`   + ${line.trim()}`);
  if (DRY) { log("·", "dry run: settings.json not written"); return true; }
  if (existsSync(SETTINGS)) log("✔", `backup: ${backup(SETTINGS)}`);
  writeFileSync(SETTINGS, after + "\n");
  return true;
};

const readSettings = () => (existsSync(SETTINGS) ? JSON.parse(readFileSync(SETTINGS, "utf8")) : {});

const applySettings = (manifest) => {
  const current = readSettings();
  const kit = snippet(join(KIT, "settings", "hooks.snippet.json"));
  let { settings: next, kept } = mergeSettings(current, kit, { kitStatusLine: manifest.statusLine });
  if (flag("personal")) {
    const personal = mergeSettings(next, snippet(join(ROOT, "personal", "settings.snippet.json")));
    next = personal.settings;
    kept = [...kept, ...personal.kept];
  }
  if (!writeSettings(current, next)) log("✔", "settings.json already has everything; not written");
  else if (!DRY) log("✔", "settings.json merged");
  if (kept.length) log("·", `kept your own value for: ${kept.join(", ")}`);
  if (next.statusLine?.command === kit.statusLine.command) manifest.statusLine = kit.statusLine.command;
};

// ─── Uninstall ──────────────────────────────────────────────
const uninstall = () => {
  const manifest = readManifest();
  if (!manifest) { log("✔", `nothing installed in ${TARGET_POSIX}`); return 0; }
  const rels = Object.keys(manifest.files);
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const kept = removeKitFile(rel, hash);
    if (kept) log("!", `${rel} had your edits; kept as ${kept}`);
  }
  if (existsSync(SETTINGS)) {
    const current = readSettings();
    if (writeSettings(current, unmergeSettings(current, { kitStatusLine: manifest.statusLine })) && !DRY)
      log("✔", "kit hooks removed from settings.json");
    if (current.permissions || current.env) log("·", "permissions and env are left as they are; --personal entries are yours to remove");
  }
  if (!DRY) rmSync(MANIFEST);
  log("✔", `${DRY ? "would remove" : "removed"} ${rels.length} files; nothing else touched`);
  return 0;
};

// ─── Install ────────────────────────────────────────────────
const install = () => {
  const previous = readManifest();
  const owned = previous?.files || {};
  if (previous && previous.route !== ROUTE)
    log("!", `previously installed by the ${previous.route} route; this run (${ROUTE}) takes over the same files`);

  const { files, cleanup } = plan();
  const manifestFiles = {};
  const conflicts = [];
  let written = 0, unchanged = 0;
  try {
    for (const [src, rel] of files) {
      if (rel in manifestFiles) throw new Error(`two kit sources want ${rel}`);
      const dest = join(TARGET, rel);
      const content = render(src);
      const hash = sha256(content);
      const exists = existsSync(dest);
      if (exists && readFileSync(dest).equals(content)) { manifestFiles[rel] = hash; unchanged++; continue; }
      const isOwned = rel in owned;
      if (exists && !isOwned && !flag("force")) { conflicts.push(rel); continue; }
      if (exists && (!isOwned || isEditedSince(dest, owned[rel]))) log("!", `${rel} ${isOwned ? "had your edits" : "was yours"}; kept as ${backup(dest)}`);
      if (!DRY) writeKitFile(dest, content);
      else log("+", rel);
      manifestFiles[rel] = hash;
      written++;
    }
  } finally {
    cleanup();
  }

  // Files the kit owned last time and no longer ships.
  const stale = Object.keys(owned).filter((rel) => !(rel in manifestFiles) && !conflicts.includes(rel));
  for (const rel of stale) {
    const kept = removeKitFile(rel, owned[rel]);
    log("-", `${rel} (left the kit)${kept ? `; your edits kept as ${kept}` : ""}`);
  }

  // Personal CLAUDE.md never overwrites yours: it lands beside it for you to merge.
  const proposed = join(ROOT, "personal", "CLAUDE.md");
  if (flag("personal") && existsSync(proposed)) {
    const mine = join(TARGET, "CLAUDE.md");
    if (!existsSync(mine)) { if (!DRY) copyFileSync(proposed, mine); log("+", "CLAUDE.md (personal)"); }
    else if (!readFileSync(proposed).equals(readFileSync(mine))) {
      if (!DRY) copyFileSync(proposed, join(TARGET, "CLAUDE.md.from-kit"));
      log("!", "CLAUDE.md exists and differs; the kit's version is in CLAUDE.md.from-kit");
    }
  }

  const manifest = { name: "vincentius-marketplace", version: VERSION, route: ROUTE, source: toPosix(ROOT),
    installedAt: new Date().toISOString(), statusLine: previous?.statusLine ?? null, files: manifestFiles };
  for (const rel of conflicts) log("✖", `${rel} exists and is not the kit's; left untouched (--force takes it over, after a backup)`);
  log(conflicts.length ? "!" : "✔",
    `${DRY ? "dry run: would write" : "wrote"} ${written}, unchanged ${unchanged}, removed ${stale.length}, conflicts ${conflicts.length} → ${TARGET_POSIX}`);

  if (flag("apply-settings")) applySettings(manifest);
  else log("·", "settings.json untouched; hooks are off until --apply-settings merges them (backup and diff first)");
  if (!DRY) writeManifest(manifest);

  const isMcpFailed = flag("with-mcp") && !installMcp();
  return conflicts.length || isMcpFailed ? 1 : 0;
};

// Returns false when the MCP server could not be added.
const installMcp = () => {
  const mcp = readVendor()["chrome-devtools-mcp"];
  // `cmd /c` is how Windows starts a pnpm shim from Claude Code; elsewhere pnpm runs directly.
  const command = IS_WINDOWS ? mcp.install.command : mcp.install.command.replace(" cmd /c ", " ");
  if (DRY) { log("·", `would run: ${command}`); return true; }
  const result = spawnSync(command, { shell: true, encoding: "utf8", env: { ...process.env, ...mcp.install.env } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").pop() || result.error?.message || "no output";
  const isAdded = result.status === 0;
  log(isAdded ? "✔" : "✖", `chrome-devtools MCP: ${output}`);
  return isAdded;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    preflight();
    process.exit(flag("uninstall") ? uninstall() : install());
  } catch (error) {
    log("✖", error.message);
    process.exit(1);
  }
}
