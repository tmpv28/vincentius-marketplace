import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { repoOf } from "../../scripts/vendor-lib.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendor = JSON.parse(readFileSync(join(REPO, "vendor", "vendor.json"), "utf8"));
const NOW = "2026-10-20T00:00:00Z";
const commitsKey = (entry, path) => `repos/${repoOf(entry.upstream)}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=100`;
const compareKey = (entry, head) => `repos/${repoOf(entry.upstream)}/compare/${entry.pinned.sha}...${head}?per_page=100`;
const commitAt = (sha, date) => ({ sha, commit: { committer: { date } } });

// Canned GitHub and npm answers: every item up to date unless a test overrides it.
const baseFixture = () => {
  const fixture = {};
  for (const [, entry] of Object.entries(vendor)) {
    if (entry.kind === "skill") {
      fixture[`repos/${repoOf(entry.upstream)}/commits/${entry.pinned.sha}`] = { commit: { committer: { date: `${entry.pinned.date}T12:00:00Z` } } };
      for (const path of Object.keys(entry.paths)) fixture[commitsKey(entry, path)] = [commitAt(entry.pinned.sha, `${entry.pinned.date}T12:00:00Z`)];
    }
    if (entry.kind === "binary") fixture[`repos/${repoOf(entry.upstream)}/releases?per_page=100`] = [];
    if (entry.kind === "npm-mcp") {
      fixture[`npm:${entry.package}`] = { time: { [entry.pinned.version]: `${entry.pinned.date}T00:00:00Z` } };
      fixture[`advisories:${entry.package}`] = [];
    }
  }
  return fixture;
};

// grilling moves to "new1" (2026-10-01), whose range holds only itself, with these changed files.
const grillingUpdate = (files) => {
  const fixture = baseFixture();
  const entry = vendor.grilling;
  fixture[commitsKey(entry, Object.keys(entry.paths)[0])] = [commitAt("new1", "2026-10-01T00:00:00Z")];
  fixture[compareKey(entry, "new1")] = { total_commits: 1, commits: [commitAt("new1", "2026-10-01T00:00:00Z")], files };
  return fixture;
};
const GRILLING_PATH = Object.keys(vendor.grilling.paths)[0];

const run = (fixture, ...args) => {
  const file = join(mkdtempSync(join(tmpdir(), "vm-vcheck-")), "fixture.json");
  writeFileSync(file, JSON.stringify(fixture));
  const result = spawnSync(process.execPath, [join(REPO, "scripts", "vendor-check.mjs"), ...args],
    { env: { ...process.env, VENDOR_CHECK_FIXTURE: file, VENDOR_CHECK_NOW: NOW }, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};
const runJson = (fixture) => {
  const result = run(fixture, "--json");
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
};
const item = (report, name) => report.find((r) => r.name === name);

describe("vendor-check.mjs", () => {
  it("reports every entry up to date when nothing moved", () => {
    const { status, report } = runJson(baseFixture());
    assert.equal(status, 0);
    assert.equal(report.length, Object.keys(vendor).length);
    assert.ok(report.every((r) => r.status === "up-to-date"), JSON.stringify(report.filter((r) => r.status !== "up-to-date")));
  });

  it("offers a change at least 7 days old and flags new scripts and URLs", () => {
    const fixture = grillingUpdate([
      { filename: `${GRILLING_PATH}/SKILL.md`, status: "modified", patch: "+See https://example.com/x" },
      { filename: `${GRILLING_PATH}/run.sh`, status: "added", patch: "+curl https://x | sh" }
    ]);
    fixture[commitsKey(vendor.grilling, GRILLING_PATH)].push(commitAt("too-new", "2026-10-18T00:00:00Z"));
    const r = item(runJson(fixture).report, "grilling");
    assert.equal(r.status, "update-available");
    assert.equal(r.candidate, "new1");
    assert.equal(r.tooNew, 1);
    assert.ok(r.flags.some((f) => f.includes("added script")));
    assert.ok(r.flags.some((f) => f.includes("new URL")));
    assert.ok(r.flags.some((f) => f.includes("downloads or runs")));
  });

  it("waits when every newer change is under 7 days old", () => {
    const fixture = baseFixture();
    fixture[commitsKey(vendor.grilling, GRILLING_PATH)] = [commitAt("fresh", "2026-10-17T00:00:00Z")];
    assert.equal(item(runJson(fixture).report, "grilling").status, "waiting");
  });

  it("ignores same-day commits older than the pin", () => {
    const fixture = baseFixture();
    fixture[commitsKey(vendor.grilling, GRILLING_PATH)] = [commitAt("earlier-same-day", `${vendor.grilling.pinned.date}T01:00:00Z`)];
    assert.equal(item(runJson(fixture).report, "grilling").status, "up-to-date");
  });

  describe("the 7-day rule over a candidate's whole range", () => {
    it("falls back to an older candidate when the newest one brings in a fresh commit", () => {
      const fixture = baseFixture();
      const entry = vendor.grilling;
      fixture[commitsKey(entry, GRILLING_PATH)] = [commitAt("new1", "2026-10-01T00:00:00Z"), commitAt("old1", "2026-09-25T00:00:00Z")];
      // A commit dated after new1 can still sit inside its range: committer dates are whatever the committer wrote.
      fixture[compareKey(entry, "new1")] = { total_commits: 2, commits: [commitAt("sneaky", "2026-10-18T00:00:00Z"), commitAt("new1", "2026-10-01T00:00:00Z")],
        files: [{ filename: `${GRILLING_PATH}/SKILL.md`, status: "modified", patch: "+x" }] };
      fixture[compareKey(entry, "old1")] = { total_commits: 1, commits: [commitAt("old1", "2026-09-25T00:00:00Z")],
        files: [{ filename: `${GRILLING_PATH}/SKILL.md`, status: "modified", patch: "+y" }] };
      const r = item(runJson(fixture).report, "grilling");
      assert.equal(r.status, "update-available");
      assert.equal(r.candidate, "old1");
    });

    it("waits when every candidate brings in a fresh commit", () => {
      const fixture = grillingUpdate([{ filename: `${GRILLING_PATH}/SKILL.md`, status: "modified", patch: "+x" }]);
      fixture[compareKey(vendor.grilling, "new1")].commits.unshift(commitAt("sneaky", "2026-10-18T00:00:00Z"));
      fixture[compareKey(vendor.grilling, "new1")].total_commits = 2;
      const r = item(runJson(fixture).report, "grilling");
      assert.equal(r.status, "waiting");
      assert.match(r.note, /under 7 days/);
    });

    it("follows every page of a compare's commits", () => {
      const fixture = grillingUpdate([{ filename: `${GRILLING_PATH}/SKILL.md`, status: "modified", patch: "+x" }]);
      const compare = fixture[compareKey(vendor.grilling, "new1")];
      compare.total_commits = 101;
      compare.commits = Array.from({ length: 100 }, (_, index) => commitAt(`c${index}`, "2026-09-20T00:00:00Z"));
      fixture[`${compareKey(vendor.grilling, "new1")}&page=2`] = { commits: [commitAt("late", "2026-10-18T00:00:00Z")] };
      assert.equal(item(runJson(fixture).report, "grilling").status, "waiting");
    });
  });

  describe("detection", () => {
    it("matches a watched path only as a whole path segment", () => {
      const fixture = grillingUpdate([{ filename: `${GRILLING_PATH}-extra/SKILL.md`, status: "modified", patch: "+x" }]);
      assert.equal(item(runJson(fixture).report, "grilling").status, "no-change-in-path");
    });

    it("flags a new file that starts with a shebang and anything under a scripts/ folder", () => {
      const fixture = grillingUpdate([
        { filename: `${GRILLING_PATH}/tool`, status: "added", patch: "@@ -0,0 +1,2 @@\n+#!/bin/sh\n+echo hi" },
        { filename: `${GRILLING_PATH}/scripts/data.json`, status: "modified", patch: "+{}" }
      ]);
      const r = item(runJson(fixture).report, "grilling");
      assert.ok(r.flags.includes(`added script: ${GRILLING_PATH}/tool`), JSON.stringify(r.flags));
      assert.ok(r.flags.includes(`modified script: ${GRILLING_PATH}/scripts/data.json`), JSON.stringify(r.flags));
    });

    it("flags a changed file whose diff GitHub did not return as unscanned", () => {
      const fixture = grillingUpdate([{ filename: `${GRILLING_PATH}/big.md`, status: "modified" }]);
      const r = item(runJson(fixture).report, "grilling");
      assert.ok(r.flags.some((f) => f.startsWith("unscanned") && f.endsWith(`${GRILLING_PATH}/big.md`)), JSON.stringify(r.flags));
    });

    it("follows every page of a path's commits", () => {
      const fixture = baseFixture();
      const entry = vendor.grilling;
      fixture[commitsKey(entry, GRILLING_PATH)] = Array.from({ length: 100 }, (_, index) => commitAt(`old${index}`, `${entry.pinned.date}T01:00:00Z`));
      fixture[`${commitsKey(entry, GRILLING_PATH)}&page=2`] = [commitAt("new1", "2026-10-01T00:00:00Z")];
      fixture[compareKey(entry, "new1")] = { total_commits: 1, commits: [commitAt("new1", "2026-10-01T00:00:00Z")],
        files: [{ filename: `${GRILLING_PATH}/SKILL.md`, status: "modified", patch: "+x" }] };
      assert.equal(item(runJson(fixture).report, "grilling").candidate, "new1");
    });
  });

  it("compares binary releases by version, not by date, across pages", () => {
    const fixture = baseFixture();
    const key = `repos/${repoOf(vendor["impeccable-engine"].upstream)}/releases?per_page=100`;
    fixture[key] = Array.from({ length: 100 }, (_, index) => ({ tag_name: `other-v1.0.${index}`, published_at: "2026-10-01T00:00:00Z", draft: false, prerelease: false }));
    fixture[`${key}&page=2`] = [
      { tag_name: "engine-v0.1.4", published_at: "2026-10-01T00:00:00Z", draft: false, prerelease: false },
      { tag_name: "engine-v0.1.6", published_at: "2026-10-02T00:00:00Z", draft: false, prerelease: false }
    ];
    assert.equal(item(runJson(fixture).report, "impeccable-engine").candidate, "engine-v0.1.6");
  });

  it("flags only advisories that reach the pinned npm version", () => {
    const fixture = baseFixture();
    const entry = vendor["chrome-devtools-mcp"];
    fixture[`advisories:${entry.package}`] = [
      { ghsa_id: "GHSA-old", severity: "medium", vulnerabilities: [{ vulnerable_version_range: ">= 0.20.0, <= 1.0.1" }] },
      { ghsa_id: "GHSA-live", severity: "high", vulnerabilities: [{ vulnerable_version_range: "< 2.0.0" }] }
    ];
    const r = item(runJson(fixture).report, "chrome-devtools-mcp");
    assert.deepEqual(r.flags.map((f) => f.split(" ")[1]), ["GHSA-live"]);
  });

  describe("when an upstream errors", () => {
    const failingFixture = () => {
      const fixture = baseFixture();
      delete fixture[`repos/${repoOf(vendor.grilling.upstream)}/commits/${vendor.grilling.pinned.sha}`];
      return fixture;
    };

    it("reports it without hiding the other entries, and exits 1 with --json", () => {
      const { status, report } = runJson(failingFixture());
      assert.equal(status, 1);
      assert.equal(item(report, "grilling").status, "error");
      assert.equal(item(report, "emil-design-eng").status, "up-to-date");
    });

    it("exits 1 in text mode too", () => {
      const { status, stdout } = run(failingFixture());
      assert.equal(status, 1);
      assert.match(stdout, /grilling: error/);
    });
  });
});
