// Monthly upstream check for everything in vendor/vendor.json. Read-only unless --bump is given.
//   node scripts/vendor-check.mjs              report every entry
//   node scripts/vendor-check.mjs --json       the same report as JSON
//   node scripts/vendor-check.mjs --bump <name>  move <name> to its candidate, re-apply patches, stop on conflict
// A candidate is the newest upstream change at least 7 days old (TV 11). Nothing is ever bumped automatically.
// VENDOR_CHECK_FIXTURE=<file.json> replaces GitHub and npm with canned responses (tests).
import { readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { VENDOR, ROOT, readVendor, buildItem } from "./vendor-lib.mjs";

const DAY = 24 * 60 * 60 * 1000;
const MIN_AGE_DAYS = 7;
const now = process.env.VENDOR_CHECK_NOW ? new Date(process.env.VENDOR_CHECK_NOW) : new Date();
const fixture = process.env.VENDOR_CHECK_FIXTURE ? JSON.parse(readFileSync(process.env.VENDOR_CHECK_FIXTURE, "utf8")) : null;

// Paths whose change needs a human read before a bump: code, hooks, and tool grants.
const SCRIPT_FILE = /\.(sh|py|js|mjs|cjs|ts|ps1|cmd|bat|exe)$/i;
const RISKY_TEXT = [
  [/https?:\/\/[^\s)"'`]+/g, "new URL"],
  [/\b(curl|wget|npx|pip install|uv run|Invoke-WebRequest|iwr)\b/g, "downloads or runs something"],
  [/^\+\s*(tools|allowed-tools|hooks|permissionMode|model)\s*:/gm, "changes a tool grant or hook"],
  [/think (step by step|carefully)|(write|show|explain) (out )?your reasoning/gi, "reasoning-extraction phrasing"],
  [/ignore (all|previous|prior) instructions|you MUST (always )?invoke/gi, "instruction-override phrasing"]
];

// Versions compare numerically, never by publish date: an older line can ship after a newer one.
const parseVersion = (text) => (String(text).match(/(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
const compareVersions = (a, b) => {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};
// GitHub advisory ranges look like ">= 0.24.0, <= 1.0.1" or "< 2.3.0".
const inRange = (version, range) => (range || "").split(",").map((part) => part.trim()).filter(Boolean).every((part) => {
  const [, op, bound] = part.match(/^(>=|<=|>|<|=)?\s*(.+)$/) || [];
  const c = compareVersions(version, bound);
  return { ">=": c >= 0, "<=": c <= 0, ">": c > 0, "<": c < 0, "=": c === 0, undefined: c === 0 }[op];
});

const repoOf = (url) => url.replace(/^https:\/\/github\.com\//, "").replace(/\/releases\/tag\/.*$/, "").replace(/\/$/, "");
const ageDays = (date) => (now - new Date(date)) / DAY;

const ghApi = (path) => {
  if (fixture) {
    if (!(path in fixture)) throw new Error(`fixture has no response for ${path}`);
    return fixture[path];
  }
  const result = spawnSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (result.status !== 0) throw new Error(`gh api ${path}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
};

const npmMeta = async (pkg) => {
  if (fixture) return fixture[`npm:${pkg}`];
  const response = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!response.ok) throw new Error(`npm registry ${pkg}: ${response.status}`);
  return response.json();
};

// ─── Per kind ───────────────────────────────────────────────
const checkSkill = (name, entry) => {
  const repo = repoOf(entry.upstream);
  const watchPaths = Object.keys(entry.paths);
  // The pinned commit's own timestamp, not its calendar day: same-day commits can sit on either side.
  const pinnedAt = new Date(ghApi(`repos/${repo}/commits/${entry.pinned.sha}`).commit.committer.date);
  const seen = new Map();
  for (const path of watchPaths) {
    const commits = ghApi(`repos/${repo}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=100`);
    for (const c of commits)
      if (c.sha !== entry.pinned.sha && new Date(c.commit.committer.date) > pinnedAt) seen.set(c.sha, c.commit.committer.date);
  }
  const newer = [...seen.entries()].sort((a, b) => new Date(b[1]) - new Date(a[1]));
  const eligible = newer.filter(([, date]) => ageDays(date) >= MIN_AGE_DAYS);
  const tooNew = newer.length - eligible.length;
  if (eligible.length === 0) return { name, kind: "skill", status: newer.length ? "waiting" : "up-to-date", tooNew, flags: [] };

  const [candidate, candidateDate] = eligible[0];
  const compare = ghApi(`repos/${repo}/compare/${entry.pinned.sha}...${candidate}`);
  const files = (compare.files || []).filter((f) => watchPaths.some((p) => f.filename.startsWith(p)));
  const flags = [];
  for (const file of files) {
    if (SCRIPT_FILE.test(file.filename)) flags.push(`${file.status} script: ${file.filename}`);
    const added = (file.patch || "").split("\n").filter((l) => l.startsWith("+")).join("\n");
    for (const [pattern, label] of RISKY_TEXT) {
      const hits = added.match(pattern);
      if (hits) flags.push(`${label} in ${file.filename}: ${[...new Set(hits)].slice(0, 3).join(", ")}`);
    }
  }
  return { name, kind: "skill", status: files.length ? "update-available" : "no-change-in-path",
    candidate, candidateDate, changedFiles: files.map((f) => `${f.status} ${f.filename}`), tooNew, flags };
};

const checkBinary = (name, entry) => {
  const repo = repoOf(entry.upstream);
  const prefix = entry.pinned.ref.replace(/v[\d.]+$/, "v");
  const releases = ghApi(`repos/${repo}/releases?per_page=50`)
    .filter((r) => r.tag_name.startsWith(prefix) && !r.draft && !r.prerelease
      && compareVersions(r.tag_name, entry.pinned.ref) > 0);
  const eligible = releases.filter((r) => ageDays(r.published_at) >= MIN_AGE_DAYS);
  if (eligible.length === 0) return { name, kind: "binary", status: releases.length ? "waiting" : "up-to-date", tooNew: releases.length, flags: [] };
  const [newest] = eligible.sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  return { name, kind: "binary", status: "update-available", candidate: newest.tag_name, candidateDate: newest.published_at,
    tooNew: releases.length - eligible.length, flags: ["binary: verify Authenticode signer and sha256 before switching"] };
};

const checkNpm = async (name, entry) => {
  const meta = await npmMeta(entry.package);
  const newer = Object.entries(meta.time)
    .filter(([v]) => /^\d+\.\d+\.\d+$/.test(v) && compareVersions(v, entry.pinned.version) > 0);
  const eligible = newer.filter(([, t]) => ageDays(t) >= MIN_AGE_DAYS).sort((a, b) => compareVersions(b[0], a[0]));
  const advisories = fixture ? fixture[`advisories:${entry.package}`] || [] : ghApi(`/advisories?ecosystem=npm&affects=${entry.package}`);
  // Only advisories that reach the pinned version are news; fixed ones stay out of the report.
  const flags = advisories
    .filter((a) => (a.vulnerabilities || []).some((v) => inRange(entry.pinned.version, v.vulnerable_version_range)))
    .map((a) => `advisory ${a.ghsa_id} (${a.severity}) affects the pinned ${entry.pinned.version}`);
  if (eligible.length === 0) return { name, kind: "npm", status: newer.length ? "waiting" : "up-to-date", tooNew: newer.length, flags };
  return { name, kind: "npm", status: "update-available", candidate: eligible[0][0], candidateDate: eligible[0][1],
    tooNew: newer.length - eligible.length, flags };
};

// ─── Bump one skill ─────────────────────────────────────────
const bump = (name, vendor, report) => {
  const entry = vendor[name];
  const item = report.find((r) => r.name === name);
  if (!entry || entry.kind !== "skill") throw new Error(`--bump supports skill entries; ${name} is ${entry?.kind}`);
  if (!item || item.status !== "update-available") { console.log(`${name}: nothing eligible to bump (${item?.status})`); return 0; }

  const backup = mkdtempSync(join(tmpdir(), `vendor-backup-${name}-`));
  cpSync(join(VENDOR, name, "upstream"), backup, { recursive: true });
  const clone = mkdtempSync(join(tmpdir(), `vendor-clone-${name}-`));
  const cloned = spawnSync("git", ["clone", "-q", "--filter=blob:none", `${entry.upstream}.git`, clone], { encoding: "utf8" });
  if (cloned.status !== 0) throw new Error(`clone failed: ${cloned.stderr}`);
  const fetched = spawnSync(process.execPath, [join(ROOT, "scripts", "vendor-fetch.mjs"), name, clone, item.candidate], { encoding: "utf8" });
  if (fetched.status !== 0) throw new Error(fetched.stderr);

  try {
    buildItem(name, entry);
  } catch (error) {
    rmSync(join(VENDOR, name, "upstream"), { recursive: true, force: true });
    cpSync(backup, join(VENDOR, name, "upstream"), { recursive: true });
    console.error(`${name}: stopped, upstream restored. ${error.message}`);
    return 1;
  }
  entry.pinned = { ref: entry.pinned.ref, sha: item.candidate, date: item.candidateDate.slice(0, 10) };
  entry.reviewed = null;
  writeFileSync(join(VENDOR, "vendor.json"), JSON.stringify(vendor, null, 2) + "\n");
  console.log(`${name}: moved to ${item.candidate.slice(0, 7)} (${item.candidateDate.slice(0, 10)}). Read the diff, set "reviewed", then commit: chore(vendor): bump ${name}`);
  return 0;
};

// ─── Main ───────────────────────────────────────────────────
const args = process.argv.slice(2);
const vendor = readVendor();
const report = [];
for (const [name, entry] of Object.entries(vendor)) {
  try {
    if (entry.kind === "skill") report.push(checkSkill(name, entry));
    else if (entry.kind === "binary") report.push(checkBinary(name, entry));
    else if (entry.kind === "npm-mcp") report.push(await checkNpm(name, entry));
  } catch (error) {
    report.push({ name, kind: entry.kind, status: "error", error: error.message, flags: [] });
  }
}

if (args[0] === "--bump") process.exit(bump(args[1], vendor, report));
if (args.includes("--json")) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

for (const r of report) {
  const shown = r.kind === "skill" ? String(r.candidate).slice(0, 7) : String(r.candidate);
  const extra = r.status === "update-available" ? ` → ${shown} (${String(r.candidateDate).slice(0, 10)})` : "";
  const waiting = r.tooNew ? `, ${r.tooNew} newer but under ${MIN_AGE_DAYS} days` : "";
  console.log(`${r.status === "error" ? "✖" : r.status === "update-available" ? "▲" : "✔"}  ${r.name}: ${r.status}${extra}${waiting}${r.error ? ` (${r.error})` : ""}`);
  for (const f of r.flags) console.log(`     ! ${f}`);
  for (const c of r.changedFiles || []) console.log(`     ${c}`);
}
process.exit(report.some((r) => r.status === "error") ? 1 : 0);
