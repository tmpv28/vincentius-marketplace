// Copies an upstream path at a pinned commit into vendor/<name>/upstream, byte for byte, plus the
// upstream licence. Used for first vendoring and by vendor-check --bump. Needs git and tar.
// Usage: node scripts/vendor-fetch.mjs <name> <local clone> [sha]   (sha defaults to vendor.json)
import { readFileSync, mkdirSync, rmSync, existsSync, copyFileSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [name, clone, shaArg] = process.argv.slice(2);
if (!name || !clone) { console.error("usage: vendor-fetch.mjs <name> <local clone> [sha]"); process.exit(2); }

const entry = JSON.parse(readFileSync(join(ROOT, "vendor", "vendor.json"), "utf8"))[name];
if (!entry) { console.error(`no vendor.json entry: ${name}`); process.exit(2); }
const sha = shaArg || entry.pinned.sha;
const git = (...args) => {
  const r = spawnSync("git", ["-C", clone, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};

const dest = join(ROOT, "vendor", name, "upstream");
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// Each mapping is "upstream/path -> folder inside upstream/", so multi-part items keep their shape.
for (const [from, to] of Object.entries(entry.paths)) {
  const staging = join(tmpdir(), `vendor-${name}-${Date.now()}`);
  mkdirSync(staging, { recursive: true });
  const archive = spawnSync("git", ["-C", clone, "archive", "--format=tar", sha, "--", from], { maxBuffer: 1 << 28 });
  if (archive.status !== 0) throw new Error(`git archive ${from}: ${archive.stderr}`);
  // cwd rather than -C: GNU tar on Windows reads "C:" in a path as a remote host.
  const untar = spawnSync("tar", ["-x"], { cwd: staging, input: archive.stdout });
  if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
  const target = join(dest, to);
  mkdirSync(join(target, ".."), { recursive: true });
  renameSync(join(staging, from), target);
  rmSync(staging, { recursive: true, force: true });
}

// The upstream licence travels with the item; a repo without one is recorded in vendor.json.
for (const file of entry.licenseFiles || []) {
  const content = git("show", `${sha}:${file}`);
  const out = join(ROOT, "vendor", name, file.split("/").pop());
  mkdirSync(join(out, ".."), { recursive: true });
  spawnSync(process.execPath, ["-e", "require('fs').writeFileSync(process.argv[1], require('fs').readFileSync(0))", out], { input: content });
}

const count = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, d) => n + (d.isDirectory() ? count(join(dir, d.name)) : 1), 0);
console.log(`${name}: ${count(dest)} files at ${sha.slice(0, 7)}`);
