// Monthly upstream check for everything in vendor/vendor.json. Read-only unless --bump is given.
//   node scripts/vendor-check.mjs              report every entry
//   node scripts/vendor-check.mjs --json       the same report as JSON
//   node scripts/vendor-check.mjs --bump <name> [--accept-flags]
//                                              move a skill to its candidate, re-apply patches, stop on conflict;
//                                              or pin a binary's candidate release by every asset's sha256
// A candidate is the newest upstream change whose every commit is at least 7 days old (TV 11). Nothing is
// ever bumped automatically, and a bump with flags needs --accept-flags after the flags have been read.
// VENDOR_CHECK_FIXTURE=<file.json> replaces GitHub and npm with canned responses (tests); a
// "clone:<owner/repo>" key in it names a local repository to clone instead of GitHub.
import { readFileSync, mkdtempSync, rmSync, cpSync, existsSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { VENDOR, readVendor, writeVendor, repoOf, buildItem, hashUpstream } from "./vendor-lib.mjs";
import { fetchUpstream } from "./vendor-fetch.mjs";

const DAY = 24 * 60 * 60 * 1000;
const MIN_AGE_DAYS = 7;
const PER_PAGE = 100;
// GitHub's compare lists at most this many files, however many changed.
const COMPARE_FILE_LIMIT = 300;
const now = process.env.VENDOR_CHECK_NOW ? new Date(process.env.VENDOR_CHECK_NOW) : new Date();
const fixture = process.env.VENDOR_CHECK_FIXTURE ? JSON.parse(readFileSync(process.env.VENDOR_CHECK_FIXTURE, "utf8")) : null;

// Paths whose change needs a human read before a bump: code, hooks, and tool grants.
const SCRIPT_FILE = /\.(sh|py|js|mjs|cjs|ts|ps1|cmd|bat|exe)$/i;
const SCRIPTS_DIR = /(^|\/)scripts\//;
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
  const [left, right] = [parseVersion(a), parseVersion(b)];
  for (let part = 0; part < 3; part++) if ((left[part] ?? 0) !== (right[part] ?? 0)) return (left[part] ?? 0) - (right[part] ?? 0);
  return 0;
};
// GitHub advisory ranges look like ">= 0.24.0, <= 1.0.1" or "< 2.3.0".
const isInRange = (version, range) => (range || "").split(",").map((part) => part.trim()).filter(Boolean).every((part) => {
  const [, op, bound] = part.match(/^(>=|<=|>|<|=)?\s*(.+)$/) || [];
  const order = compareVersions(version, bound);
  return { ">=": order >= 0, "<=": order <= 0, ">": order > 0, "<": order < 0, "=": order === 0, undefined: order === 0 }[op];
});

const ageDays = (date) => (now - new Date(date)) / DAY;

const ghApi = (path) => {
  if (fixture) {
    if (!(path in fixture)) throw new Error(`fixture has no response for ${path}`);
    return fixture[path];
  }
  const result = spawnSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (result.status !== 0) throw new Error(`gh api ${path}: ${result.error?.message ?? result.stderr.trim()}`);
  return JSON.parse(result.stdout);
};

// Every page of a list endpoint whose path already carries per_page=100: a full page means there may be
// another. Paged by hand rather than gh --paginate so the fixtures page the same way.
const ghList = (path) => {
  const all = [];
  for (let page = 1; ; page++) {
    const body = ghApi(page === 1 ? path : `${path}&page=${page}`);
    all.push(...body);
    if (body.length < PER_PAGE) return all;
  }
};

// A compare pages its commits; the file list comes with the first page only.
const ghCompare = (repo, base, head) => {
  const path = `repos/${repo}/compare/${base}...${head}?per_page=${PER_PAGE}`;
  const first = ghApi(path);
  if (!Array.isArray(first.commits)) throw new Error(`compare ${base.slice(0, 7)}...${head.slice(0, 7)} returned no commit list`);
  const commits = [...first.commits];
  const total = first.total_commits ?? commits.length;
  for (let page = 2; commits.length < total; page++) {
    const next = ghApi(`${path}&page=${page}`);
    if (!next.commits?.length) throw new Error(`compare ${base.slice(0, 7)}...${head.slice(0, 7)}: page ${page} is empty at ${commits.length} of ${total} commits`);
    commits.push(...next.commits);
  }
  return { files: first.files || [], commits };
};

const npmMeta = async (pkg) => {
  if (fixture) return fixture[`npm:${pkg}`];
  const response = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!response.ok) throw new Error(`npm registry ${pkg}: ${response.status}`);
  return response.json();
};

// ─── Per kind ───────────────────────────────────────────────
const flagsFor = (files) => {
  const flags = [];
  if (files.length >= COMPARE_FILE_LIMIT) flags.push(`unscanned: GitHub listed ${files.length} files, the most it lists; the rest were not read`);
  for (const file of files) {
    const addedLines = (file.patch || "").split("\n").filter((line) => line.startsWith("+"));
    const isNewShebang = file.status === "added" && /^\+#!/.test(addedLines[0] ?? "");
    if (SCRIPT_FILE.test(file.filename) || SCRIPTS_DIR.test(file.filename) || isNewShebang) flags.push(`${file.status} script: ${file.filename}`);
    // GitHub leaves `patch` out for a binary or an oversized diff; either way nothing below read it.
    if (file.patch === undefined && file.status !== "removed") flags.push(`unscanned (diff too large or binary): ${file.filename}`);
    const added = addedLines.join("\n");
    for (const [pattern, label] of RISKY_TEXT) {
      const hits = added.match(pattern);
      if (hits) flags.push(`${label} in ${file.filename}: ${[...new Set(hits)].slice(0, 3).join(", ")}`);
    }
  }
  return flags;
};

const checkSkill = (name, entry) => {
  const repo = repoOf(entry.upstream);
  const watchPaths = Object.keys(entry.paths);
  const isWatched = (file) => Boolean(file) && watchPaths.some((path) => file === path || file.startsWith(`${path}/`));
  // The pinned commit's own timestamp, not its calendar day: same-day commits can sit on either side.
  const pinnedAt = new Date(ghApi(`repos/${repo}/commits/${entry.pinned.sha}`).commit.committer.date);
  const seen = new Map();
  for (const path of watchPaths) {
    const commits = ghList(`repos/${repo}/commits?path=${encodeURIComponent(path)}&since=${entry.pinned.date}T00:00:00Z&per_page=${PER_PAGE}`);
    for (const commit of commits)
      if (commit.sha !== entry.pinned.sha && new Date(commit.commit.committer.date) > pinnedAt) seen.set(commit.sha, commit.commit.committer.date);
  }
  const newer = [...seen.entries()].sort((a, b) => new Date(b[1]) - new Date(a[1]));
  const eligible = newer.filter(([, date]) => ageDays(date) >= MIN_AGE_DAYS);
  const tooNew = newer.length - eligible.length;
  if (eligible.length === 0) return { name, kind: "skill", status: newer.length ? "waiting" : "up-to-date", tooNew, flags: [] };

  // The candidate's own date is not enough: every commit it brings in must be old enough, and committer
  // dates are whatever the committer wrote. Fall back to an older candidate whose range is clean.
  for (const [candidate, candidateDate] of eligible) {
    const compare = ghCompare(repo, entry.pinned.sha, candidate);
    if (compare.commits.some((c) => ageDays(c.commit.committer.date) < MIN_AGE_DAYS)) continue;
    const files = compare.files.filter((f) => isWatched(f.filename) || isWatched(f.previous_filename));
    return { name, kind: "skill", status: files.length ? "update-available" : "no-change-in-path",
      candidate, candidateDate, changedFiles: files.map((f) => `${f.status} ${f.filename}`), tooNew, flags: flagsFor(files) };
  }
  return { name, kind: "skill", status: "waiting", tooNew,
    note: `every candidate brings in a commit under ${MIN_AGE_DAYS} days old`, flags: [] };
};

const checkBinary = (name, entry) => {
  const repo = repoOf(entry.upstream);
  const prefix = entry.pinned.ref.replace(/v[\d.]+$/, "v");
  const releases = ghList(`repos/${repo}/releases?per_page=${PER_PAGE}`)
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
    .filter((a) => (a.vulnerabilities || []).some((v) => isInRange(entry.pinned.version, v.vulnerable_version_range)))
    .map((a) => `advisory ${a.ghsa_id} (${a.severity}) affects the pinned ${entry.pinned.version}`);
  if (eligible.length === 0) return { name, kind: "npm", status: newer.length ? "waiting" : "up-to-date", tooNew: newer.length, flags };
  return { name, kind: "npm", status: "update-available", candidate: eligible[0][0], candidateDate: eligible[0][1],
    tooNew: newer.length - eligible.length, flags };
};

const printItem = (item) => {
  const shown = item.kind === "skill" ? String(item.candidate).slice(0, 7) : String(item.candidate);
  const extra = item.status === "update-available" ? ` → ${shown} (${String(item.candidateDate).slice(0, 10)})` : "";
  const waiting = item.tooNew ? `, ${item.tooNew} newer but under ${MIN_AGE_DAYS} days` : "";
  const icon = item.status === "error" ? "✖" : item.status === "update-available" ? "▲" : "✔";
  console.log(`${icon}  ${item.name}: ${item.status}${extra}${waiting}${item.note ? `; ${item.note}` : ""}${item.error ? ` (${item.error})` : ""}`);
  for (const flag of item.flags) console.log(`     ! ${flag}`);
  for (const file of item.changedFiles || []) console.log(`     ${file}`);
};

// ─── Bump one binary ────────────────────────────────────────
// Pins every platform asset by the digest GitHub computed at upload. The release's own .sha256 sidecars
// are not used: they come from the same place as the binaries, so they cannot vouch for them.
const bumpBinary = (name, entry, item, vendor) => {
  const repo = repoOf(entry.upstream);
  const assets = (ghApi(`repos/${repo}/releases/tags/${item.candidate}`).assets || []).filter((asset) => !asset.name.endsWith(".sha256"));
  const undigested = assets.filter((asset) => !/^sha256:[0-9a-f]{64}$/.test(asset.digest ?? "")).map((asset) => asset.name);
  if (assets.length === 0 || undigested.length) {
    console.error(`${name}: GitHub has no sha256 digest for ${undigested.join(", ") || "any asset"} of ${item.candidate}; download and hash them by hand, never run them`);
    return 1;
  }
  if (!assets.some((asset) => asset.name === entry.asset)) {
    console.error(`${name}: ${item.candidate} has no ${entry.asset}`);
    return 1;
  }
  const previousRef = entry.pinned.ref;
  entry.upstream = `https://github.com/${repo}/releases/tag/${item.candidate}`;
  entry.pinned = { ref: item.candidate, date: item.candidateDate.slice(0, 10) };
  entry.assetSha256 = Object.fromEntries(assets.map((asset) => [asset.name, asset.digest.slice("sha256:".length)]).sort(([a], [b]) => (a < b ? -1 : 1)));
  if (entry.install?.path) entry.install.path = entry.install.path.split(previousRef).join(item.candidate);
  // The recorded signer vouched for the previous binary; install refuses until someone checks the new one.
  entry.signer = null;
  entry.reviewed = null;
  writeVendor(vendor);
  console.log(`${name}: moved to ${item.candidate} with ${assets.length} pinned asset hashes. Verify the Authenticode signer of ${entry.asset}, record it, set "reviewed", regenerate any patch that embeds these hashes, then commit: chore(vendor): bump ${name}`);
  return 0;
};

// ─── Bump ───────────────────────────────────────────────────
const bump = (name, vendor, report, shouldAcceptFlags) => {
  const entry = vendor[name];
  const item = report.find((r) => r.name === name);
  if (!entry || !["skill", "binary"].includes(entry.kind)) { console.error(`--bump supports skill and binary entries; ${name} is ${entry?.kind ?? "not in vendor.json"}`); return 2; }
  if (!item || item.status !== "update-available") {
    console.log(`${name}: nothing eligible to bump (${item?.status}${item?.error ? `: ${item.error}` : ""})`);
    return item?.status === "error" ? 1 : 0;
  }
  printItem(item);
  if (item.flags.length && !shouldAcceptFlags) {
    console.error(`${name}: ${item.flags.length} flag${item.flags.length === 1 ? "" : "s"} above. Read them in the upstream diff, then rerun with --accept-flags.`);
    return 1;
  }
  if (entry.kind === "binary") return bumpBinary(name, entry, item, vendor);

  const repo = repoOf(entry.upstream);
  const upstream = join(VENDOR, name, "upstream");
  const licences = (entry.licenseFiles || []).map((file) => join(VENDOR, name, basename(file)));
  const backup = mkdtempSync(join(tmpdir(), `vendor-backup-${name}-`));
  const clone = mkdtempSync(join(tmpdir(), `vendor-clone-${name}-`));
  let built = null;
  let isBumped = false;
  let shouldKeepBackup = false;
  try {
    cpSync(upstream, join(backup, "upstream"), { recursive: true });
    licences.forEach((file, index) => { if (existsSync(file)) copyFileSync(file, join(backup, `licence-${index}`)); });
    const source = fixture?.[`clone:${repo}`] ?? `${entry.upstream}.git`;
    const cloned = spawnSync("git", ["clone", "-q", "--no-checkout", "--filter=blob:none", source, clone], { encoding: "utf8" });
    if (cloned.status !== 0) throw new Error(`clone failed: ${cloned.error?.message ?? cloned.stderr}`);
    const { executables } = fetchUpstream(name, entry, clone, item.candidate);
    built = buildItem(name, entry);
    const tags = spawnSync("git", ["-C", clone, "tag", "--points-at", item.candidate, "--sort=-version:refname"], { encoding: "utf8" });
    if (tags.status !== 0) throw new Error(`git tag: ${tags.stderr}`);
    const [tag] = tags.stdout.split("\n").filter(Boolean);
    entry.pinned = { ref: tag ?? item.candidate, sha: item.candidate, date: item.candidateDate.slice(0, 10) };
    // Cleared on purpose: install refuses the item until someone has read the diff and set the date.
    entry.reviewed = null;
    entry.upstreamSha256 = hashUpstream(name);
    entry.executables = executables;
    writeVendor(vendor);
    isBumped = true;
    console.log(`${name}: moved to ${entry.pinned.ref === item.candidate ? item.candidate.slice(0, 7) : `${entry.pinned.ref} (${item.candidate.slice(0, 7)})`}. Read the diff, set "reviewed", run node scripts/notices.mjs, then commit: chore(vendor): bump ${name}`);
    if (executables.length) console.log(`  record the executable bit: git add --chmod=+x -- ${executables.map((path) => `vendor/${name}/upstream/${path}`).join(" ")}`);
    return 0;
  } catch (error) {
    console.error(`${name}: stopped, upstream restored. ${error.message}`);
    return 1;
  } finally {
    if (!isBumped) {
      try {
        rmSync(upstream, { recursive: true, force: true });
        cpSync(join(backup, "upstream"), upstream, { recursive: true });
        licences.forEach((file, index) => {
          const saved = join(backup, `licence-${index}`);
          if (existsSync(saved)) copyFileSync(saved, file);
          else rmSync(file, { force: true });
        });
      } catch (error) {
        shouldKeepBackup = true;
        console.error(`${name}: restoring failed (${error.message}); the previous upstream and licences are in ${backup}`);
      }
    }
    for (const dir of [clone, built, shouldKeepBackup ? null : backup]) if (dir) rmSync(dir, { recursive: true, force: true });
  }
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

if (args[0] === "--bump") process.exit(bump(args[1], vendor, report, args.includes("--accept-flags")));
const hasErrors = report.some((r) => r.status === "error");
if (args.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(hasErrors ? 1 : 0);
}
for (const item of report) printItem(item);
process.exit(hasErrors ? 1 : 0);
