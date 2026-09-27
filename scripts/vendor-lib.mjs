// Shared vendoring helpers: read vendor.json, and rebuild an item from its pristine upstream plus
// its patches. Patches are plain `git diff --no-index a b` output, applied with `git apply -p2`.
import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync, existsSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { toPosix, sha256, walk } from "./files.mjs";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
// VENDOR_DIR points the scripts at a scratch copy; only the tests set it.
export const VENDOR = process.env.VENDOR_DIR || join(ROOT, "vendor");

// Upstream bytes go through git untouched: with this machine's core.autocrlf=true, git archive and git
// apply would otherwise rewrite line endings on the way in.
export const GIT_VERBATIM = ["-c", "core.autocrlf=false", "-c", "core.eol=lf"];

export const readVendor = () => JSON.parse(readFileSync(join(VENDOR, "vendor.json"), "utf8"));

export const writeVendor = (vendor) => {
  const text = JSON.stringify(vendor, null, 2) + "\n";
  const file = join(VENDOR, "vendor.json");
  if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
};

// "owner/repo" from an upstream URL, which may point at a release tag.
export const repoOf = (url) => url.replace(/^https:\/\/github\.com\//, "").replace(/\/releases\/tag\/.*$/, "").replace(/\/$/, "");

// One sha256 over every upstream file's path and content. Not a git tree id: a plugin cache copy has
// no .git, and the check has to mean the same thing there as in a clone.
export const hashUpstream = (name) => {
  const upstream = join(VENDOR, name, "upstream");
  if (!existsSync(upstream)) throw new Error(`${name}: vendor/${name}/upstream is missing`);
  const lines = walk(upstream).map((file) => {
    const rel = toPosix(relative(upstream, file));
    if (lstatSync(file).isSymbolicLink()) throw new Error(`${name}: upstream holds a symlink, ${rel}`);
    return [rel, `${sha256(readFileSync(file))}  ${rel}\n`];
  });
  return sha256(lines.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, line]) => line).join(""));
};

// Refuses an item nobody has read since its last bump (the bump clears `reviewed`), or whose upstream
// is no longer the copy that was read.
export const verifyItem = (name, entry) => {
  if (!entry.reviewed) throw new Error(`${name}: not reviewed since its last bump; read the diff, then set "reviewed" in vendor/vendor.json`);
  if (!entry.upstreamSha256) throw new Error(`${name}: vendor/vendor.json records no upstreamSha256`);
  const actual = hashUpstream(name);
  if (actual !== entry.upstreamSha256)
    throw new Error(`${name}: vendor/${name}/upstream is not the reviewed copy (sha256 ${actual.slice(0, 12)}, recorded ${entry.upstreamSha256.slice(0, 12)})`);
};

// Applies every patch of `name`, in order, to a copy of its upstream. Returns the copy's path.
// A patch that no longer applies throws: that is the signal to re-read upstream, never to force it.
export const buildItem = (name, entry, into = null) => {
  const upstream = join(VENDOR, name, "upstream");
  if (!existsSync(upstream)) throw new Error(`${name}: vendor/${name}/upstream is missing`);
  // Always patch outside any repository: inside one, git apply resolves paths against that repo's root
  // and skips files it cannot match, silently, with exit code 0.
  const work = mkdtempSync(join(tmpdir(), `vendor-build-${name}-`));
  cpSync(upstream, work, { recursive: true });
  for (const patch of entry.patches || []) {
    const file = join(VENDOR, name, "patches", patch);
    const result = spawnSync("git", [...GIT_VERBATIM, "apply", "-p2", "--verbose", "--whitespace=nowarn", file], { cwd: work, encoding: "utf8" });
    if (result.error) {
      rmSync(work, { recursive: true, force: true });
      throw new Error(`${name}: git is needed to apply patches and could not run (${result.error.message})`);
    }
    const output = `${result.stdout}${result.stderr}`;
    const touched = (readFileSync(file, "utf8").match(/^\+\+\+ /gm) || []).length;
    const applied = (output.match(/^Applied patch /gm) || []).length;
    if (result.status !== 0 || /Skipped patch/.test(output) || applied !== touched) {
      rmSync(work, { recursive: true, force: true });
      throw new Error(`${name}: patch ${patch} did not apply (${applied} of ${touched} files)\n${output}`);
    }
  }
  if (!into) return work;
  rmSync(into, { recursive: true, force: true });
  cpSync(work, into, { recursive: true });
  rmSync(work, { recursive: true, force: true });
  return into;
};
