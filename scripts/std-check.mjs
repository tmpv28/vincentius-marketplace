// The repo's gate: syntax, em-dashes in code-adjacent files, then every test suite. No dependencies,
// because a kit that people install should not need an install of its own to check itself.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set([".git", "node_modules", "coverage", "standard", "vendor", ".tmp", "templates"]);
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".json", ".ts", ".tsx", ".scss", ".css", ".ps1", ".sh"]);
const EM_DASH = String.fromCharCode(0x2014);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else out.push(full);
  }
  return out;
};

const bold = (text) => `\x1b[1m${text}\x1b[22m`;
const red = (text) => `\x1b[31m${text}\x1b[39m`;
const green = (text) => `\x1b[32m${text}\x1b[39m`;
const failures = [];

// ─── Step 1: syntax ─────────────────────────────────────────
const files = walk(ROOT);
for (const file of files.filter((f) => [".js", ".mjs", ".cjs"].includes(extname(f)))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`syntax: ${relative(ROOT, file)}\n${result.stderr.trim()}`);
}

// ─── Step 2: em-dashes in code-adjacent text (00 #5) ─────────
for (const file of files.filter((f) => CODE_EXT.has(extname(f)))) {
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    if (line.includes(EM_DASH)) failures.push(`em-dash: ${relative(ROOT, file)}:${index + 1}`);
  });
}

// ─── Step 3: tests ──────────────────────────────────────────
for (const suite of ["tests/unit", "tests/install"]) {
  if (!existsSync(join(ROOT, suite))) continue;
  const testFiles = readdirSync(join(ROOT, suite)).filter((f) => f.endsWith(".test.mjs")).map((f) => join(suite, f));
  if (testFiles.length === 0) continue;
  const result = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) failures.push(`tests: ${suite}\n${(result.stdout + result.stderr).split("\n").filter((l) => /not ok|✖|fail \d/.test(l)).join("\n")}`);
}

if (failures.length === 0) {
  console.log(green("✔  ") + bold("Spotless. Syntax, em-dashes and tests all clear."));
  process.exit(0);
}
console.log(red("✖  ") + bold(`${failures.length} problem${failures.length === 1 ? "" : "s"}. Not done.`));
for (const failure of failures) console.log(`   ${failure.replace(/\n/g, "\n   ")}`);
process.exit(1);
