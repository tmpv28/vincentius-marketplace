// THIRD_PARTY_NOTICES.md is generated from vendor/vendor.json, so the table of changes cannot drift from
// the patches that actually ship.
//   node scripts/notices.mjs           rewrite THIRD_PARTY_NOTICES.md when it changed
//   node scripts/notices.mjs --check   list drift and undescribed patches; exit 1 on any
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

import { VENDOR, readVendor } from "./vendor-lib.mjs";
import { isRunDirectly } from "./files.mjs";

// Beside vendor/, so a scratch VENDOR_DIR carries its own notices file.
export const NOTICES_FILE = join(VENDOR, "..", "THIRD_PARTY_NOTICES.md");

const HEADER = `# Third-party notices

This repository redistributes the third-party work listed below, unmodified in \`vendor/<name>/upstream/\`
and with any changes recorded as separate patch files in \`vendor/<name>/patches/\`. The patch files are
the statement of changes that the Apache License 2.0, section 4(b), asks for. Each item keeps its own
licence; the MIT licence in \`LICENSE\` covers only this repository's original work.

\`vendor/vendor.json\` is the machine-readable version of this table: upstream, path, pinned commit,
licence, patches and review date. This file is generated from it by \`node scripts/notices.mjs\`; edit
vendor.json, then regenerate.

| Item | Upstream | Pinned | Licence | Licence file | Changes |
| --- | --- | --- | --- | --- | --- |
`;

const KIND_SCOPE = {
  binary: "binary, not stored in this repo",
  "npm-mcp": "configuration only; the package is fetched by pnpm"
};

// A pipe inside a cell would end it.
const cell = (text) => String(text).replace(/\|/g, "\\|");

const itemOf = (name, entry) => {
  const scope = entry.kind === "skill" ? (entry.install?.agents ? "skill and agents" : null) : KIND_SCOPE[entry.kind];
  return scope ? `${name} (${scope})` : name;
};

const pinnedOf = (entry) => {
  if (entry.kind === "npm-mcp") return entry.pinned.version;
  if (!entry.pinned.sha) return entry.pinned.ref;
  const short = entry.pinned.sha.slice(0, 7);
  return entry.pinned.ref === entry.pinned.sha ? short : `${entry.pinned.ref} (${short})`;
};

const licenceFileOf = (name, entry) => {
  if (entry.licenseFiles?.length) return entry.licenseFiles.map((file) => `\`vendor/${name}/${basename(file)}\``).join(", ");
  return entry.kind === "skill" ? "none upstream" : "upstream";
};

const changesOf = (entry) => {
  const patches = entry.patches || [];
  if (patches.length === 0) return "none";
  return patches.map((patch) => `\`${patch}\`: ${entry.patchNotes?.[patch] ?? "(undescribed)"}`).join("; ");
};

export const renderNotices = (vendor) => HEADER + Object.entries(vendor)
  .map(([name, entry]) => `| ${[itemOf(name, entry), entry.upstream, pinnedOf(entry), entry.license, licenceFileOf(name, entry), changesOf(entry)].map(cell).join(" | ")} |\n`)
  .join("");

// Every problem that would make the notices wrong, as one line each; an empty list means they are right.
export const checkNotices = (vendor = readVendor(), noticesFile = NOTICES_FILE) => {
  const problems = [];
  for (const [name, entry] of Object.entries(vendor)) {
    const patches = entry.patches || [];
    for (const patch of patches) {
      if (!entry.patchNotes?.[patch]) problems.push(`${name}: ${patch} has no patchNotes entry in vendor.json`);
      if (!existsSync(join(VENDOR, name, "patches", patch))) problems.push(`${name}: ${patch} is listed but vendor/${name}/patches/${patch} is missing`);
    }
    for (const noted of Object.keys(entry.patchNotes || {}))
      if (!patches.includes(noted)) problems.push(`${name}: patchNotes describes ${noted}, which is not in its patches`);
    const patchDir = join(VENDOR, name, "patches");
    for (const file of existsSync(patchDir) ? readdirSync(patchDir) : [])
      if (!patches.includes(file)) problems.push(`${name}: vendor/${name}/patches/${file} is not listed, so it never applies`);
  }
  const current = existsSync(noticesFile) ? readFileSync(noticesFile, "utf8") : null;
  if (current !== renderNotices(vendor)) problems.push("THIRD_PARTY_NOTICES.md is out of date: run node scripts/notices.mjs");
  return problems;
};

// ─── Main ───────────────────────────────────────────────────
if (isRunDirectly(import.meta.url)) {
  const vendor = readVendor();
  if (process.argv.includes("--check")) {
    const problems = checkNotices(vendor);
    for (const problem of problems) console.log(`✖  ${problem}`);
    if (problems.length === 0) console.log("✔  Notices match vendor.json.");
    process.exit(problems.length ? 1 : 0);
  }
  const text = renderNotices(vendor);
  const current = existsSync(NOTICES_FILE) ? readFileSync(NOTICES_FILE, "utf8") : null;
  if (current === text) console.log("✔  THIRD_PARTY_NOTICES.md already matches vendor.json.");
  else {
    writeFileSync(NOTICES_FILE, text);
    console.log("✔  THIRD_PARTY_NOTICES.md regenerated.");
  }
  const undescribed = checkNotices(vendor).filter((problem) => !problem.startsWith("THIRD_PARTY_NOTICES.md"));
  for (const problem of undescribed) console.log(`✖  ${problem}`);
  process.exit(undescribed.length ? 1 : 0);
}
