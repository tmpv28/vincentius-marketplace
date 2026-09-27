import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { makeTempDir, writeTree, skillEntry, runScript } from "./vendor-helpers.mjs";

// notices.mjs reads patches through VENDOR, which vendor-lib resolves on import: set it first.
const vendorDir = join(makeTempDir("notices"), "vendor");
process.env.VENDOR_DIR = vendorDir;
const { renderNotices, checkNotices, NOTICES_FILE } = await import("../../scripts/notices.mjs");

const vendorWith = (entry) => {
  writeTree(join(vendorDir, "demo", "patches"), Object.fromEntries((entry.patches || []).map((patch) => [patch, "diff\n"])));
  return { demo: entry };
};
const patched = () => vendorWith(skillEntry({ patches: ["001-a.patch"], patchNotes: { "001-a.patch": "does a" } }));

describe("renderNotices", () => {
  it("lists each patch with its note, and none for an unpatched item", () => {
    assert.match(renderNotices(patched()), /`001-a\.patch`: does a \|$/m);
    assert.match(renderNotices({ demo: skillEntry() }), /\| none \|$/m);
  });

  it("shows the pinned tag beside the short sha", () => {
    const entry = skillEntry({ pinned: { ref: "v1.2.3", sha: "abcdef1234567890", date: "2026-09-01" } });
    assert.match(renderNotices({ demo: entry }), /\| v1\.2\.3 \(abcdef1\) \|/);
  });
});

describe("checkNotices", () => {
  it("finds nothing when the file is current and every patch is described", () => {
    const vendor = patched();
    writeFileSync(NOTICES_FILE, renderNotices(vendor));
    assert.deepEqual(checkNotices(vendor), []);
  });

  it("reports a stale file", () => {
    const vendor = patched();
    writeFileSync(NOTICES_FILE, "old\n");
    assert.deepEqual(checkNotices(vendor), ["THIRD_PARTY_NOTICES.md is out of date: run node scripts/notices.mjs"]);
  });

  it("reports a patch with no note, a note with no patch, and a patch file nobody lists", () => {
    const vendor = vendorWith(skillEntry({ patches: ["001-a.patch"], patchNotes: { "009-gone.patch": "old" } }));
    writeTree(join(vendorDir, "demo", "patches"), { "002-stray.patch": "diff\n" });
    writeFileSync(NOTICES_FILE, renderNotices(vendor));
    assert.deepEqual(checkNotices(vendor), [
      "demo: 001-a.patch has no patchNotes entry in vendor.json",
      "demo: patchNotes describes 009-gone.patch, which is not in its patches",
      "demo: vendor/demo/patches/002-stray.patch is not listed, so it never applies"
    ]);
  });
});

describe("notices.mjs", () => {
  it("--check exits 1 on drift and the plain run repairs it", () => {
    const scratch = join(makeTempDir("notices-cli"), "vendor");
    writeTree(scratch, { "vendor.json": JSON.stringify({ demo: skillEntry() }) });
    const env = { VENDOR_DIR: scratch };
    assert.equal(runScript("notices.mjs", ["--check"], env).status, 1);
    assert.equal(runScript("notices.mjs", [], env).status, 0);
    assert.equal(runScript("notices.mjs", ["--check"], env).status, 0);
    assert.match(readFileSync(join(scratch, "..", "THIRD_PARTY_NOTICES.md"), "utf8"), /^# Third-party notices/);
  });
});
