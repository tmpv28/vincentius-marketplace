// Scratch vendor trees and upstream repositories for the vendoring tests. Nothing here touches the real
// vendor/: the scripts are pointed at a scratch copy through VENDOR_DIR.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const makeTempDir = (prefix) => mkdtempSync(join(tmpdir(), `vm-${prefix}-`));

export const writeTree = (dir, files) => {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
};

export const readTree = (dir, prefix = "") => {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, readTree(join(dir, entry.name), rel));
    else out[rel] = readFileSync(join(dir, entry.name), "latin1");
  }
  return out;
};

// A skill entry as vendor.json holds one; each test overrides what it is about.
export const skillEntry = (overrides = {}) => ({
  kind: "skill",
  upstream: "https://github.com/test/demo",
  paths: { skill: "skill" },
  install: { skill: "skills/demo" },
  pinned: { ref: "main", sha: "0".repeat(40), date: "2026-09-01" },
  license: "MIT",
  licenseFiles: [],
  patches: [],
  invocation: "auto",
  reviewed: "2026-09-02",
  ...overrides
});

// <dir>/vendor with vendor.json and each item's upstream files and patches. Returns the vendor dir.
export const makeScratchVendor = (items) => {
  const vendorDir = join(makeTempDir("vendor"), "vendor");
  const vendor = {};
  for (const [name, { entry, upstream = {}, patches = {} }] of Object.entries(items)) {
    vendor[name] = entry;
    writeTree(join(vendorDir, name, "upstream"), upstream);
    writeTree(join(vendorDir, name, "patches"), patches);
  }
  writeTree(vendorDir, { "vendor.json": JSON.stringify(vendor, null, 2) + "\n" });
  return vendorDir;
};

export const readScratchVendor = (vendorDir) => JSON.parse(readFileSync(join(vendorDir, "vendor.json"), "utf8"));

// A patch in the shape vendor-patch writes: git diff --no-index between a/ and b/, applied with -p2.
export const makePatch = (before, after) => {
  const stage = makeTempDir("patch");
  writeTree(join(stage, "a"), before);
  writeTree(join(stage, "b"), after);
  const diff = spawnSync("git", ["-c", "core.autocrlf=false", "diff", "--no-index", "--no-color", "a", "b"], { cwd: stage, encoding: "utf8" });
  return diff.stdout;
};

export const runScript = (script, args, env = {}) => spawnSync(process.execPath, [join(REPO, "scripts", script), ...args],
  { env: { ...process.env, ...env }, encoding: "utf8" });

// A local upstream repository, one commit per element of `commits` ({ files, executables, tag }).
// Returns its path and the commit shas in order. core.autocrlf is off so a CRLF file is committed as CRLF.
export const makeUpstreamRepo = (commits) => {
  const dir = makeTempDir("upstream");
  const git = (...args) => {
    const result = spawnSync("git", ["-C", dir, "-c", "core.autocrlf=false", "-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
    return result.stdout.trim();
  };
  git("init", "-q");
  const shas = [];
  for (const { files, executables = [], tag } of commits) {
    writeTree(dir, files);
    git("add", "-A");
    for (const path of executables) git("update-index", "--chmod=+x", path);
    git("commit", "-q", "-m", `commit ${shas.length + 1}`);
    shas.push(git("rev-parse", "HEAD"));
    if (tag) git("tag", tag);
  }
  return { dir, shas };
};
