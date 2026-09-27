import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { makeTempDir, writeTree, skillEntry } from "./vendor-helpers.mjs";

// vendor-lib resolves VENDOR once, on import: point it at a scratch dir first.
const vendorDir = join(makeTempDir("vendor-lib"), "vendor");
process.env.VENDOR_DIR = vendorDir;
const { hashUpstream, verifyItem } = await import("../../scripts/vendor-lib.mjs");

// A fresh item under the scratch vendor dir, with its sha256 recorded as a reviewed copy.
let itemCount = 0;
const makeItem = (files = { "skill/SKILL.md": "text\n", "skill/nested/a.md": "a\n" }) => {
  const name = `item${itemCount++}`;
  writeTree(join(vendorDir, name, "upstream"), files);
  return { name, entry: skillEntry({ upstreamSha256: hashUpstream(name) }) };
};

describe("hashUpstream", () => {
  it("changes when a file's content, name or presence changes", () => {
    const { name, entry } = makeItem();
    const upstream = join(vendorDir, name, "upstream");
    appendFileSync(join(upstream, "skill", "SKILL.md"), "more\n");
    const afterEdit = hashUpstream(name);
    assert.notEqual(afterEdit, entry.upstreamSha256);
    writeFileSync(join(upstream, "skill", "extra.md"), "");
    assert.notEqual(hashUpstream(name), afterEdit);
  });

  it("does not depend on the order files were written in", () => {
    const { name: first } = makeItem({ "skill/b.md": "b\n", "skill/a.md": "a\n" });
    const { name: second } = makeItem({ "skill/a.md": "a\n", "skill/b.md": "b\n" });
    assert.equal(hashUpstream(first), hashUpstream(second));
  });
});

describe("verifyItem", () => {
  it("passes a reviewed item whose upstream is the recorded copy", () => {
    const { name, entry } = makeItem();
    assert.doesNotThrow(() => verifyItem(name, entry));
  });

  it("refuses an item that was not reviewed since its last bump", () => {
    const { name, entry } = makeItem();
    assert.throws(() => verifyItem(name, { ...entry, reviewed: null }), /not reviewed/);
  });

  it("refuses an upstream edited after the review", () => {
    const { name, entry } = makeItem();
    appendFileSync(join(vendorDir, name, "upstream", "skill", "SKILL.md"), "injected\n");
    assert.throws(() => verifyItem(name, entry), /not the reviewed copy/);
  });

  it("refuses an upstream with a file removed", () => {
    const { name, entry } = makeItem();
    rmSync(join(vendorDir, name, "upstream", "skill", "nested", "a.md"));
    assert.throws(() => verifyItem(name, entry), /not the reviewed copy/);
  });

  it("refuses an entry with no recorded sha256", () => {
    const { name, entry } = makeItem();
    assert.throws(() => verifyItem(name, { ...entry, upstreamSha256: undefined }), /no upstreamSha256/);
  });

  it("refuses an item whose upstream is missing", () => {
    const { name, entry } = makeItem();
    rmSync(join(vendorDir, name, "upstream"), { recursive: true });
    assert.throws(() => verifyItem(name, entry), /upstream is missing/);
  });
});
