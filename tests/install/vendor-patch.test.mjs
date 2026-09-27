import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { makeScratchVendor, readScratchVendor, skillEntry, makePatch, runScript } from "./vendor-helpers.mjs";

const LINES = ["---", "name: demo", "---", "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const SKILL = LINES.join("\n") + "\n";
const replaceLine = (text, from, to) => text.split("\n").map((line) => (line === from ? to : line)).join("\n");

// A scratch item "demo" and a runner for vendor-patch against it.
const setUp = (patches = {}) => {
  const vendorDir = makeScratchVendor({ demo: { entry: skillEntry({ patches: Object.keys(patches) }), upstream: { "skill/SKILL.md": SKILL }, patches } });
  const work = join(vendorDir, "demo", ".work", "skill", "SKILL.md");
  const patchTool = (...args) => runScript("vendor-patch.mjs", args, { VENDOR_DIR: vendorDir });
  const edit = (from, to) => writeFileSync(work, replaceLine(readFileSync(work, "utf8"), from, to));
  const patchText = (patch) => readFileSync(join(vendorDir, "demo", "patches", patch), "utf8");
  const built = () => {
    patchTool("start", "demo", "--force");
    return readFileSync(work, "utf8");
  };
  return { vendorDir, patchTool, edit, patchText, built };
};

describe("vendor-patch.mjs", () => {
  it("saving over an existing patch keeps what it already changed", () => {
    const { patchTool, edit, built } = setUp();
    patchTool("start", "demo");
    edit("two", "TWO");
    assert.equal(patchTool("save", "demo", "001-edits.patch").status, 0);
    assert.equal(patchTool("start", "demo", "001-edits.patch").status, 0);
    edit("eight", "EIGHT");
    const result = patchTool("save", "demo", "001-edits.patch");
    assert.equal(result.status, 0, result.stderr);
    const text = built();
    assert.ok(text.includes("\nTWO\n") && text.includes("\nEIGHT\n"), text);
  });

  it("builds side a from only the patches before the one being replaced", () => {
    const { vendorDir, patchTool, edit, patchText } = setUp({
      "001-first.patch": makePatch({ "skill/SKILL.md": SKILL }, { "skill/SKILL.md": replaceLine(SKILL, "one", "ONE") })
    });
    patchTool("start", "demo");
    edit("five", "FIVE");
    assert.equal(patchTool("save", "demo", "002-second.patch").status, 0);
    assert.equal(patchTool("start", "demo", "002-second.patch", "--force").status, 0);
    edit("nine", "NINE");
    assert.equal(patchTool("save", "demo", "002-second.patch").status, 0);
    assert.doesNotMatch(patchText("002-second.patch"), /\+ONE/);
    assert.match(patchText("002-second.patch"), /\+FIVE[\s\S]*\+NINE/);
    assert.deepEqual(readScratchVendor(vendorDir).demo.patches, ["001-first.patch", "002-second.patch"]);
  });

  it("refuses a new patch name that does not sort after the existing ones", () => {
    const { patchTool, edit } = setUp({ "002-b.patch": makePatch({ "skill/SKILL.md": SKILL }, { "skill/SKILL.md": replaceLine(SKILL, "one", "ONE") }) });
    patchTool("start", "demo");
    edit("two", "TWO");
    const result = patchTool("save", "demo", "001-a.patch");
    assert.equal(result.status, 2);
    assert.match(result.stderr, /must sort after 002-b\.patch/);
  });

  it("refuses to save over a patch from a work copy started with later patches", () => {
    const { patchTool, edit, patchText } = setUp({
      "001-a.patch": makePatch({ "skill/SKILL.md": SKILL }, { "skill/SKILL.md": replaceLine(SKILL, "one", "ONE") }),
      "002-b.patch": makePatch({ "skill/SKILL.md": replaceLine(SKILL, "one", "ONE") }, { "skill/SKILL.md": replaceLine(replaceLine(SKILL, "one", "ONE"), "nine", "NINE") })
    });
    const before = patchText("001-a.patch");
    patchTool("start", "demo");
    edit("five", "FIVE");
    const result = patchTool("save", "demo", "001-a.patch");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /start demo 001-a\.patch/);
    assert.equal(patchText("001-a.patch"), before);
  });

  it("refuses a replacement that a later patch no longer applies on, and keeps the old patch", () => {
    const withOne = replaceLine(SKILL, "one", "ONE");
    const { patchTool, edit, patchText } = setUp({
      "001-a.patch": makePatch({ "skill/SKILL.md": SKILL }, { "skill/SKILL.md": withOne }),
      "002-b.patch": makePatch({ "skill/SKILL.md": withOne }, { "skill/SKILL.md": replaceLine(withOne, "ONE", "One!") })
    });
    const before = patchText("001-a.patch");
    patchTool("start", "demo", "001-a.patch");
    edit("ONE", "uno");
    const result = patchTool("save", "demo", "001-a.patch");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no longer builds/);
    assert.equal(patchText("001-a.patch"), before);
  });

  it("start refuses to overwrite an existing work copy without --force", () => {
    const { vendorDir, patchTool, edit } = setUp();
    patchTool("start", "demo");
    edit("two", "unsaved");
    const result = patchTool("start", "demo");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--force/);
    assert.match(readFileSync(join(vendorDir, "demo", ".work", "skill", "SKILL.md"), "utf8"), /unsaved/);
    assert.equal(patchTool("start", "demo", "--force").status, 0);
    assert.equal(existsSync(join(vendorDir, "demo", ".work", "skill", "SKILL.md")), true);
  });
});
