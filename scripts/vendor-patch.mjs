// Records a change to a vendored item as a patch file, never as an edit to upstream/.
//   node scripts/vendor-patch.mjs start <name> [<patch>] [--force]
//        vendor/<name>/.work = upstream + every patch, or + the patches up to and including <patch>
//   (edit files under vendor/<name>/.work)
//   node scripts/vendor-patch.mjs save <name> <NNN-why.patch>
//        a new name, sorting after the others, records the edits as the last patch; an existing name
//        replaces that patch and needs a work copy started at it
import { writeFileSync, mkdtempSync, rmSync, cpSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { VENDOR, GIT_VERBATIM, readVendor, writeVendor, buildItem } from "./vendor-lib.mjs";

// Which patches the work copy was built from, kept inside it so save knows the diff's base.
const BASE_MARKER = ".vendor-patch-base.json";

const args = process.argv.slice(2);
const isForced = args.includes("--force");
const [command, name, patchName] = args.filter((arg) => !arg.startsWith("--"));
const fail = (message, code = 1) => { console.error(message); process.exit(code); };

const vendor = readVendor();
const entry = vendor[name];
if (!entry) fail(`no vendor.json entry: ${name}`, 2);
const patches = entry.patches || [];
const work = join(VENDOR, name, ".work");
const marker = join(work, BASE_MARKER);
const areSameLists = (a, b) => a.length === b.length && a.every((patch, index) => patch === b[index]);

if (command === "start") {
  if (existsSync(work) && !isForced) fail(`vendor/${name}/.work already exists and may hold unsaved edits; save it, or rerun with --force to discard it`);
  if (patchName && !patches.includes(patchName)) fail(`${name} has no patch ${patchName}; start without one to add a new patch`, 2);
  const base = patchName ? patches.slice(0, patches.indexOf(patchName) + 1) : patches;
  buildItem(name, { ...entry, patches: base }, work);
  writeFileSync(marker, JSON.stringify({ patches: base }) + "\n");
  console.log(`edit vendor/${name}/.work, then: node scripts/vendor-patch.mjs save ${name} ${patchName ?? "<NNN-why.patch>"}`);
} else if (command === "save") {
  if (!patchName || !existsSync(work)) fail("run start first, and name the patch", 2);
  if (!existsSync(marker)) fail(`vendor/${name}/.work does not say what it was built from; start it again`);
  const index = patches.indexOf(patchName);
  const isReplacing = index !== -1;
  // Patches apply in list order and are read in name order; a new one must be last in both.
  if (!isReplacing && patches.some((patch) => patch >= patchName)) fail(`${patchName} must sort after ${patches.at(-1)}`, 2);
  // Saving over patch N diffs against the patches before it, so the work copy must hold N and nothing after.
  const expectedBase = isReplacing ? patches.slice(0, index + 1) : patches;
  const { patches: startedFrom } = JSON.parse(readFileSync(marker, "utf8"));
  if (!areSameLists(startedFrom, expectedBase))
    fail(`vendor/${name}/.work was started from [${startedFrom.join(", ")}]; to save ${patchName} start it with: node scripts/vendor-patch.mjs start ${name}${isReplacing ? ` ${patchName}` : ""} --force`);

  const stage = mkdtempSync(join(tmpdir(), `vendor-patch-${name}-`));
  const patchFile = join(VENDOR, name, "patches", patchName);
  const previous = existsSync(patchFile) ? readFileSync(patchFile) : null;
  // A message instead of an exit inside the try: process.exit would skip the finally and leak the stage.
  let refusal = null;
  try {
    buildItem(name, { ...entry, patches: patches.slice(0, isReplacing ? index : patches.length) }, join(stage, "a"));
    cpSync(work, join(stage, "b"), { recursive: true, filter: (src) => src !== marker });
    const diff = spawnSync("git", [...GIT_VERBATIM, "diff", "--no-index", "--no-color", "a", "b"], { cwd: stage, encoding: "utf8", maxBuffer: 1 << 28 });
    // git diff --no-index exits 1 when the trees differ; anything above that is git failing.
    if (diff.error || diff.status > 1) throw new Error(`git diff: ${diff.error?.message ?? diff.stderr}`);
    if (diff.stdout.trim() === "") refusal = "no changes to save";
    else {
      mkdirSync(join(VENDOR, name, "patches"), { recursive: true });
      writeFileSync(patchFile, diff.stdout.replace(/\r\n/g, "\n"));
      const updated = { ...entry, patches: isReplacing ? patches : [...patches, patchName] };
      // A replaced patch must leave every later one applying on top of it.
      try {
        rmSync(buildItem(name, updated), { recursive: true, force: true });
        entry.patches = updated.patches;
        writeVendor(vendor);
      } catch (error) {
        if (previous) writeFileSync(patchFile, previous);
        else rmSync(patchFile, { force: true });
        refusal = `not saved; the patch series no longer builds with it, and ${patchName} is as it was.\n${error.message}`;
      }
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  if (refusal) fail(refusal);
  rmSync(work, { recursive: true, force: true });
  console.log(`saved vendor/${name}/patches/${patchName}${entry.patchNotes?.[patchName] ? "" : `; describe it under patchNotes in vendor.json, then run node scripts/notices.mjs`}`);
} else {
  fail("usage: vendor-patch.mjs start <name> [<patch>] [--force] | save <name> <patch>", 2);
}
