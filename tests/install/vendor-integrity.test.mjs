import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO, readTree, makeTempDir, writeTree } from "./vendor-helpers.mjs";
import { readVendor, verifyItem, buildItem } from "../../scripts/vendor-lib.mjs";
import { checkNotices } from "../../scripts/notices.mjs";

// The committed vendor/ itself, as it ships: reviewed, untampered, described and buildable.
const vendor = readVendor();
const skills = Object.entries(vendor).filter(([, entry]) => entry.kind === "skill");
const isGitCheckout = existsSync(join(REPO, ".git"));
const git = (...args) => spawnSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout;
// The comment syntax differs per file (<!-- -->, #, rem); the sentence does not.
const MODIFIED_NOTICE = "Modified by vincentius-marketplace; see THIRD_PARTY_NOTICES.md";
const hasShAndCurl = spawnSync("sh", ["-c", "command -v curl"], { encoding: "utf8" }).status === 0;

const builds = new Map();
const built = (name) => {
  if (!builds.has(name)) builds.set(name, buildItem(name, vendor[name]));
  return builds.get(name);
};
const builtText = (name) => Object.values(readTree(built(name))).join("\n");
const frontmatterOf = (name) => readFileSync(join(built(name), "skill", "SKILL.md"), "utf8").split("\n---")[0];

describe("vendor/", () => {
  after(() => { for (const dir of builds.values()) rmSync(dir, { recursive: true, force: true }); });

  it("holds only reviewed skills whose upstream is the recorded copy", () => {
    for (const [name, entry] of skills) assert.doesNotThrow(() => verifyItem(name, entry), name);
  });

  it("has notices that match vendor.json, with every patch described", () => {
    assert.deepEqual(checkNotices(), []);
  });

  it("marks exactly the recorded executables as 100755 in the git index", { skip: !isGitCheckout }, () => {
    const indexed = git("ls-files", "-s", "vendor").split("\n").filter((line) => line.startsWith("100755 ")).map((line) => line.split("\t")[1]).sort();
    const recorded = skills.flatMap(([name, entry]) => (entry.executables || []).map((path) => `vendor/${name}/upstream/${path}`)).sort();
    assert.deepEqual(indexed, recorded);
  });

  it("is checked out with the index's line endings", { skip: !isGitCheckout }, () => {
    const crlf = git("ls-files", "--eol", "vendor").split("\n").filter((line) => /\bw\/crlf\b/.test(line) && !/\bi\/crlf\b/.test(line));
    assert.deepEqual(crlf, []);
  });

  describe("built items", () => {
    it("build with every patch applied", () => {
      for (const [name] of skills) assert.ok(existsSync(join(built(name), "skill", "SKILL.md")), name);
    });

    it("are manual-only exactly where vendor.json says so", () => {
      for (const [name, entry] of skills)
        assert.equal(/^disable-model-invocation: true$/m.test(frontmatterOf(name)), entry.invocation === "manual", name);
    });

    it("carry a modification notice in every file a patch changes, for Apache-2.0 items", () => {
      for (const [name, entry] of skills.filter(([, e]) => e.license.startsWith("Apache-2.0"))) {
        for (const patch of entry.patches) {
          const changed = [...readFileSync(join(REPO, "vendor", name, "patches", patch), "utf8").matchAll(/^\+\+\+ b\/b\/(.+)$/gm)].map((m) => m[1]);
          for (const rel of changed) assert.ok(readFileSync(join(built(name), rel), "utf8").includes(MODIFIED_NOTICE), `${name}: ${rel}`);
        }
      }
    });

    it("pin every engine asset's sha256 in both launchers, for the engine version the skill ships", () => {
      const engine = vendor["impeccable-engine"];
      const scripts = join(built("impeccable"), "skill", "scripts");
      const version = readFileSync(join(scripts, "VERSION"), "utf8").trim();
      assert.equal(engine.pinned.ref, `engine-v${version}`);
      const sh = readFileSync(join(scripts, "impeccable"), "utf8");
      const cmd = readFileSync(join(scripts, "impeccable.cmd"), "utf8");
      for (const [asset, hash] of Object.entries(engine.assetSha256)) {
        assert.ok(sh.includes(`${version}/${asset}) echo ${hash} ;;`), `sh: ${asset}`);
        if (asset.startsWith("impeccable-windows-"))
          assert.ok(cmd.includes(`if "%version%/%asset%"=="${version}/${asset}" set "expected=${hash}"`), `cmd: ${asset}`);
      }
      assert.doesNotMatch(sh + cmd, /%url%\.sha256|"\$url\.sha256"/);
    });

    it("refuse a downloaded engine whose sha256 is not pinned, whatever its sidecar and download base say", { skip: !hasShAndCurl }, () => {
      const scratch = makeTempDir("launcher");
      const release = join(scratch, "release", "engine-v0.1.5");
      const fake = "#!/bin/sh\necho FAKE-ENGINE-RAN\n";
      const fakeHash = createHash("sha256").update(fake).digest("hex");
      for (const asset of Object.keys(vendor["impeccable-engine"].assetSha256))
        writeTree(release, { [asset]: fake, [`${asset}.sha256`]: `${fakeHash}  ${asset}\n` });
      const result = spawnSync("sh", [join(built("impeccable"), "skill", "scripts", "impeccable"), "engine-probe"], { encoding: "utf8", env: {
        ...process.env, HOME: scratch, USERPROFILE: scratch, IMPECCABLE_HOME: join(scratch, "cache"), IMPECCABLE_BIN: "",
        IMPECCABLE_DOWNLOAD_BASE: pathToFileURL(join(scratch, "release")).href } });
      assert.equal(result.status, 127, result.stderr);
      assert.match(result.stderr, /checksum mismatch/);
      assert.doesNotMatch(result.stdout, /FAKE-ENGINE-RAN/);
    });

    // Commands only, where a line, a code span, a quote or a prompt starts them: "the simple-icons npm
    // package" and "never an unpinned npm install" are prose. Against the unpatched upstreams this finds 22.
    const NPM_COMMAND = /(^|[`"'(]|\$ )\s*(npm (install|i|add|run|test|exec|ci|create)\b|npx \S|yarn (add|install|dlx|create)\b)/m;

    it("never tell the agent to run npm, npx or yarn where a patch replaced them", () => {
      for (const name of ["design-taste-frontend", "vercel-react-best-practices", "systematic-debugging", "impeccable"])
        assert.doesNotMatch(builtText(name), NPM_COMMAND, name);
      assert.doesNotMatch(builtText("systematic-debugging"), /superpowers:/);
      assert.doesNotMatch(builtText("impeccable"), /CLAUDE_PLUGIN_ROOT/);
      assert.doesNotMatch(builtText("swiftui-expert-skill"), /\$\{SKILL_DIR\}/);
    });
  });
});
