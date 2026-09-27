// Shared vendoring helpers: read vendor.json, and rebuild an item from its pristine upstream plus
// its patches. Patches are plain `git diff --no-index a b` output, applied with `git apply -p2`.
import { readFileSync, cpSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const VENDOR = join(ROOT, "vendor");

export const readVendor = () => JSON.parse(readFileSync(join(VENDOR, "vendor.json"), "utf8"));

// Applies every patch of `name`, in order, to a copy of its upstream. Returns the copy's path.
// A patch that no longer applies throws: that is the signal to re-read upstream, never to force it.
export const buildItem = (name, entry, into = mkdtempSync(join(tmpdir(), `vendor-build-${name}-`))) => {
  const upstream = join(VENDOR, name, "upstream");
  if (!existsSync(upstream)) throw new Error(`${name}: vendor/${name}/upstream is missing`);
  rmSync(into, { recursive: true, force: true });
  cpSync(upstream, into, { recursive: true });
  for (const patch of entry.patches || []) {
    const file = join(VENDOR, name, "patches", patch);
    const result = spawnSync("git", ["apply", "-p2", "--whitespace=nowarn", file], { cwd: into, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${name}: patch ${patch} does not apply\n${result.stderr}`);
  }
  return into;
};
