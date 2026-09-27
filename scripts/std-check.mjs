// The repo's gate: syntax, em-dashes in code-adjacent files, then every test suite. No dependencies,
// because a kit that people install should not need an install of its own to check itself.
import { readdirSync, readFileSync, lstatSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { walk } from "./files.mjs";
import { checkNotices } from "./notices.mjs";

// The hooks are CommonJS; the em-dash notice and this gate share one list of code-adjacent files.
const { CODE_ADJACENT_FILE } = createRequire(import.meta.url)("../kit/hooks/tv/code-extensions.js");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// templates is skipped because the template carries its own std:check, which judges it by its own rules.
const SKIP_DIRS = new Set([".git", "node_modules", "coverage", "standard", "vendor", ".tmp", "templates"]);
const EM_DASH = String.fromCharCode(0x2014);

const bold = (text) => `\x1b[1m${text}\x1b[22m`;
const red = (text) => `\x1b[31m${text}\x1b[39m`;
const green = (text) => `\x1b[32m${text}\x1b[39m`;
const failures = [];

// ─── Step 1: syntax ─────────────────────────────────────────
// A symlink is skipped rather than followed: a loop or a dangling link must not break the gate.
const files = walk(ROOT, (name) => SKIP_DIRS.has(name)).filter((file) => !lstatSync(file).isSymbolicLink());
for (const file of files.filter((f) => [".js", ".mjs", ".cjs"].includes(extname(f)))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.error) failures.push(`syntax: could not run node --check on ${relative(ROOT, file)} (${result.error.message})`);
  else if (result.status !== 0) failures.push(`syntax: ${relative(ROOT, file)}\n${result.stderr.trim()}`);
}

// ─── Step 2: em-dashes in code-adjacent text (00 #5) ─────────
for (const file of files.filter((f) => CODE_ADJACENT_FILE.test(f))) {
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    if (line.includes(EM_DASH)) failures.push(`em-dash: ${relative(ROOT, file)}:${index + 1}`);
  });
}

// ─── Step 3: third-party notices match vendor.json ────────────
for (const problem of checkNotices()) failures.push(`notices: ${problem}`);

// ─── Step 4: tests ──────────────────────────────────────────
for (const suite of ["tests/unit", "tests/install"]) {
  if (!existsSync(join(ROOT, suite))) continue;
  const testFiles = readdirSync(join(ROOT, suite)).filter((f) => f.endsWith(".test.mjs")).map((f) => join(suite, f));
  if (testFiles.length === 0) continue;
  const result = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: ROOT, encoding: "utf8" });
  if (result.error) failures.push(`tests: ${suite} could not run (${result.error.message})`);
  else if (result.status !== 0) failures.push(`tests: ${suite}\n${(result.stdout + result.stderr).split("\n").filter((l) => /not ok|✖|fail \d/.test(l)).join("\n")}`);
}

if (failures.length === 0) {
  console.log(green("✔  ") + bold("Spotless. Syntax, em-dashes and tests all clear."));
  process.exit(0);
}
console.log(red("✖  ") + bold(`${failures.length} problem${failures.length === 1 ? "" : "s"}. Not done.`));
for (const failure of failures) console.log(`   ${failure.replace(/\n/g, "\n   ")}`);
process.exit(1);
