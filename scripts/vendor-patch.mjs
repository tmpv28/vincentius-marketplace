// Records a change to a vendored item as a patch file, never as an edit to upstream/.
//   node scripts/vendor-patch.mjs start <name>             vendor/<name>/.work = upstream + current patches
//   (edit files under vendor/<name>/.work)
//   node scripts/vendor-patch.mjs save <name> <NNN-why.patch>   writes the diff, adds it to vendor.json
import { writeFileSync, mkdtempSync, rmSync, cpSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { VENDOR, readVendor, buildItem } from "./vendor-lib.mjs";

const [command, name, patchName] = process.argv.slice(2);
const vendor = readVendor();
const entry = vendor[name];
if (!entry) { console.error(`no vendor.json entry: ${name}`); process.exit(2); }
const work = join(VENDOR, name, ".work");

if (command === "start") {
  buildItem(name, entry, work);
  console.log(`edit vendor/${name}/.work, then: node scripts/vendor-patch.mjs save ${name} <NNN-why.patch>`);
} else if (command === "save") {
  if (!patchName || !existsSync(work)) { console.error("run start first, and name the patch"); process.exit(2); }
  const stage = mkdtempSync(join(tmpdir(), `vendor-patch-${name}-`));
  buildItem(name, entry, join(stage, "a"));
  cpSync(work, join(stage, "b"), { recursive: true });
  const diff = spawnSync("git", ["diff", "--no-index", "--no-color", "a", "b"], { cwd: stage, encoding: "utf8" });
  if (diff.stdout.trim() === "") { console.error("no changes to save"); process.exit(1); }
  mkdirSync(join(VENDOR, name, "patches"), { recursive: true });
  writeFileSync(join(VENDOR, name, "patches", patchName), diff.stdout.replace(/\r\n/g, "\n"));
  if (!entry.patches.includes(patchName)) entry.patches.push(patchName);
  writeFileSync(join(VENDOR, "vendor.json"), JSON.stringify(vendor, null, 2) + "\n");
  rmSync(stage, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
  console.log(`saved vendor/${name}/patches/${patchName}`);
} else {
  console.error("usage: vendor-patch.mjs start|save <name> [patch]");
  process.exit(2);
}
