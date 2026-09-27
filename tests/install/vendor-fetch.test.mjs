import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { makeScratchVendor, readScratchVendor, skillEntry, makeUpstreamRepo, runScript } from "./vendor-helpers.mjs";

const CRLF_TEXT = "first\r\nsecond\r\n";

// An upstream at one commit and a scratch vendor whose entry pins it.
const setUp = (files, executables = []) => {
  const { dir, shas: [sha] } = makeUpstreamRepo([{ files: { "LICENSE": "MIT\n", ...files }, executables }]);
  const vendorDir = makeScratchVendor({ demo: { entry: skillEntry({ pinned: { ref: "main", sha, date: "2026-09-01" }, licenseFiles: ["LICENSE"] }) } });
  const fetch = () => runScript("vendor-fetch.mjs", ["demo", dir], { VENDOR_DIR: vendorDir });
  return { vendorDir, fetch };
};

describe("vendor-fetch.mjs", () => {
  it("copies upstream byte for byte, whatever core.autocrlf says, and records the executables", () => {
    const { vendorDir, fetch } = setUp({ "skill/SKILL.md": "lf only\n", "skill/crlf.txt": CRLF_TEXT, "skill/tool.sh": "#!/bin/sh\n" }, ["skill/tool.sh"]);
    const result = fetch();
    assert.equal(result.status, 0, result.stderr);
    const upstream = join(vendorDir, "demo", "upstream", "skill");
    assert.equal(readFileSync(join(upstream, "SKILL.md"), "latin1"), "lf only\n");
    assert.equal(readFileSync(join(upstream, "crlf.txt"), "latin1"), CRLF_TEXT);
    assert.equal(readFileSync(join(vendorDir, "demo", "LICENSE"), "utf8"), "MIT\n");
    const entry = readScratchVendor(vendorDir).demo;
    assert.deepEqual(entry.executables, ["skill/tool.sh"]);
    assert.match(entry.upstreamSha256, /^[0-9a-f]{64}$/);
    assert.match(result.stdout, /git add --chmod=\+x -- vendor\/demo\/upstream\/skill\/tool\.sh/);
  });

  it("clears the review when the fetched content is not the recorded copy", () => {
    const { vendorDir, fetch } = setUp({ "skill/SKILL.md": "text\n" });
    assert.equal(fetch().status, 0);
    assert.equal(readScratchVendor(vendorDir).demo.reviewed, null);
  });

  it("refuses a file that export-ignore left out of the archive", () => {
    const { fetch } = setUp({ "skill/SKILL.md": "text\n", "skill/hidden.md": "hidden\n", ".gitattributes": "skill/hidden.md export-ignore\n" });
    const result = fetch();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hidden\.md is missing from the archive/);
  });

  it("refuses a file that export-subst rewrote", () => {
    const { vendorDir, fetch } = setUp({ "skill/SKILL.md": "commit $Format:%H$\n", ".gitattributes": "skill/SKILL.md export-subst\n" });
    const result = fetch();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SKILL\.md differs from its upstream blob/);
    assert.equal(existsSync(join(vendorDir, "demo", "LICENSE")), false);
  });
});
