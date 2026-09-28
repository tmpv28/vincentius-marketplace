// Copies an upstream path at a pinned commit into vendor/<name>/upstream, byte for byte, plus the
// upstream licence. Used for first vendoring and by vendor-check --bump. Needs git and tar.
// Usage: node scripts/vendor-fetch.mjs <name> <local clone>   (fetches the sha pinned in vendor.json)
import { mkdirSync, rmSync, existsSync, writeFileSync, mkdtempSync, cpSync, chmodSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { VENDOR, GIT_VERBATIM, readVendor, writeVendor, hashUpstream } from "./vendor-lib.mjs";
import { walk, isRunDirectly } from "./files.mjs";

const gitIn = (clone, args, input) => {
  const result = spawnSync("git", ["-C", clone, ...GIT_VERBATIM, ...args], { input, maxBuffer: 1 << 28 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
};

// Every entry under `from` at `sha`, as git records it: mode, type, blob and path.
const listTree = (clone, sha, from) => gitIn(clone, ["ls-tree", "-r", "-z", sha, "--", from]).toString("utf8").split("\0").filter(Boolean)
  .map((line) => {
    const [meta, path] = line.split("\t");
    const [mode, type, blob] = meta.split(" ");
    return { mode, type, blob, path };
  });

// Returns the files written and the executables among them, as paths inside upstream/.
export const fetchUpstream = (name, entry, clone, sha) => {
  const dest = join(VENDOR, name, "upstream");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const executables = [];
  let fileCount = 0;

  // Each mapping is "upstream/path -> folder inside upstream/", so multi-part items keep their shape.
  for (const [from, to] of Object.entries(entry.paths)) {
    const target = join(dest, to);
    const staging = mkdtempSync(join(tmpdir(), `vendor-${name}-`));
    try {
      const archive = gitIn(clone, ["archive", "--format=tar", sha, "--", from]);
      // cwd rather than -C: GNU tar on Windows reads "C:" in a path as a remote host.
      const untar = spawnSync("tar", ["-x"], { cwd: staging, input: archive });
      if (untar.status !== 0) throw new Error(`tar: ${untar.error?.message ?? untar.stderr}`);
      mkdirSync(join(target, ".."), { recursive: true });
      cpSync(join(staging, from), target, { recursive: true });
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }

    // The archive is not proof: export-ignore drops files and export-subst rewrites them. Every file must
    // be the exact blob the tree records, and nothing else may be there.
    const tree = listTree(clone, sha, from);
    const localOf = (path) => (path === from ? target : join(target, path.slice(from.length + 1)));
    for (const node of tree) {
      if (node.type !== "blob" || node.mode === "120000") throw new Error(`${name}: ${node.path} is a ${node.mode === "120000" ? "symlink" : node.type}; vendoring takes plain files only`);
      if (!existsSync(localOf(node.path))) throw new Error(`${name}: ${node.path} is missing from the archive (export-ignore?)`);
    }
    const hashes = gitIn(clone, ["hash-object", "--no-filters", "--stdin-paths"], tree.map((node) => localOf(node.path)).join("\n") + "\n")
      .toString("utf8").trim().split(/\r?\n/);
    tree.forEach((node, index) => {
      if (hashes[index] !== node.blob) throw new Error(`${name}: ${node.path} differs from its upstream blob (export-subst?)`);
      if (node.mode !== "100755") return;
      const inside = `${to}${node.path === from ? "" : node.path.slice(from.length)}`;
      executables.push(inside);
      chmodSync(localOf(node.path), 0o755);
    });
    const written = walk(target).length;
    if (written !== tree.length) throw new Error(`${name}: ${from} wrote ${written} files, the tree lists ${tree.length}`);
    fileCount += written;
  }

  // The upstream licence travels with the item; a repo without one is recorded in vendor.json.
  for (const file of entry.licenseFiles || []) writeFileSync(join(VENDOR, name, basename(file)), gitIn(clone, ["cat-file", "blob", `${sha}:${file}`]));

  return { fileCount, executables: executables.sort() };
};

// ─── Main ───────────────────────────────────────────────────
if (isRunDirectly(import.meta.url)) {
  const [name, clone] = process.argv.slice(2);
  if (!name || !clone) { console.error("usage: vendor-fetch.mjs <name> <local clone>"); process.exit(2); }
  const vendor = readVendor();
  const entry = vendor[name];
  if (!entry) { console.error(`no vendor.json entry: ${name}`); process.exit(2); }

  const { fileCount, executables } = fetchUpstream(name, entry, clone, entry.pinned.sha);
  const digest = hashUpstream(name);
  // Content nobody has read yet: install refuses it until "reviewed" is set again.
  if (digest !== entry.upstreamSha256) entry.reviewed = null;
  entry.upstreamSha256 = digest;
  entry.executables = executables;
  writeVendor(vendor);
  console.log(`${name}: ${fileCount} files at ${entry.pinned.sha.slice(0, 7)}${entry.reviewed ? "" : "; not reviewed, install refuses it until \"reviewed\" is set"}`);
  if (executables.length) console.log(`  record the executable bit: git add --chmod=+x -- ${executables.map((path) => `vendor/${name}/upstream/${path}`).join(" ")}`);
}
