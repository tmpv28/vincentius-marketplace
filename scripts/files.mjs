// File helpers shared by the installer and the repo scripts.
import { readdirSync, lstatSync, existsSync, rmdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, sep, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

// Claude Code's config folder: $CLAUDE_CONFIG_DIR when set, ~/.claude otherwise.
export const configDir = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");

// True when the module at `moduleUrl` is the script node was started with, not an import.
export const isRunDirectly = (moduleUrl) => Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(moduleUrl);

export const toPosix = (path) => path.split(sep).join("/");

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

// Every file under `dir`, depth first. Symlinks are listed, never followed: a loop or a dangling link
// must not crash a walk. `skipDir(name)` prunes a directory by its own name.
export const walk = (dir, skipDir = () => false, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (lstatSync(full).isDirectory()) { if (!skipDir(name)) walk(full, skipDir, out); }
    else out.push(full);
  }
  return out;
};

// Removes `dir` and every parent up to (not including) `stop` while they are empty.
export const pruneEmptyDirs = (dir, stop) => {
  let current = dir;
  while (current.length > stop.length && current.startsWith(stop) && existsSync(current) && readdirSync(current).length === 0) {
    rmdirSync(current);
    current = join(current, "..");
  }
};
