import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const install = (target, ...flags) => spawnSync(process.execPath, [join(REPO, "install.mjs"), ...flags],
  { env: { ...process.env, CLAUDE_CONFIG_DIR: target, CLAUDE_PLUGIN_ROOT: "" }, encoding: "utf8" });
const fresh = () => mkdtempSync(join(tmpdir(), "vm-install-"));
const manifestOf = (target) => JSON.parse(readFileSync(join(target, "vincentius-marketplace.installed.json"), "utf8"));
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (lstatSync(full).isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
};

describe("install.mjs", () => {
  let target;
  before(() => {
    target = fresh();
    assert.equal(install(target).status, 0);
  });

  describe("a fresh install", () => {
    it("writes every manifest file, as real files", () => {
      const { files } = manifestOf(target);
      assert.ok(files.length > 300);
      for (const rel of files) {
        assert.ok(existsSync(join(target, rel)), rel);
        assert.equal(lstatSync(join(target, rel)).isSymbolicLink(), false, rel);
      }
    });

    it("installs the core and all seven packs, each with its marker", () => {
      for (const pack of ["core", "typescript", "react", "accessibility", "styles", "scss", "testing", "node-tooling"])
        assert.match(readFileSync(join(target, "rules", "tv", `${pack}.md`), "utf8"), new RegExp(`TV-PACK: ${pack}`));
    });

    it("gives every pack except the core a paths list", () => {
      assert.doesNotMatch(readFileSync(join(target, "rules", "tv", "core.md"), "utf8"), /^paths:/m);
      assert.match(readFileSync(join(target, "rules", "tv", "react.md"), "utf8"), /^paths:\n {2}- "\*\*\/\*\.tsx"/m);
    });

    it("inlines the code-review checklist into the review agent", () => {
      const agent = readFileSync(join(target, "agents", "tv-standard-review.md"), "utf8");
      assert.doesNotMatch(agent, /\{\{include:/);
      assert.match(agent, /Does this already exist\?/);
    });

    it("builds vendored skills with their patches and without excluded files", () => {
      assert.match(readFileSync(join(target, "skills", "grilling", "SKILL.md"), "utf8"), /disable-model-invocation: true/);
      assert.equal(existsSync(join(target, "skills", "systematic-debugging", "test-pressure-1.md")), false);
      assert.match(readFileSync(join(target, "skills", "systematic-debugging", "find-polluter.sh"), "utf8"), /pnpm test/);
      assert.doesNotMatch(readFileSync(join(target, "agents", "impeccable-asset-producer.md"), "utf8"), /CLAUDE_PLUGIN_ROOT/);
    });

    it("never ships the template's node_modules or .env.local", () => {
      const files = walk(join(target, "templates"));
      assert.equal(files.some((f) => /node_modules|[\\/]\.env\.local$/.test(f)), false);
    });

    it("records the route and the source", () => {
      const manifest = manifestOf(target);
      assert.equal(manifest.route, "clone");
      assert.ok(manifest.source.endsWith("vincentius-marketplace"));
    });

    it("leaves settings.json alone without --apply-settings", () => {
      assert.equal(existsSync(join(target, "settings.json")), false);
    });
  });

  it("is idempotent: a second run writes nothing", () => {
    const result = install(target);
    assert.match(result.stdout, /wrote 0, unchanged \d+, removed 0, conflicts 0/);
  });

  it("dry-run reports additions and writes nothing", () => {
    const empty = fresh();
    const result = install(empty, "--dry-run");
    assert.equal(result.status, 0);
    assert.match(result.stdout, /dry run: would write \d+/);
    assert.equal(existsSync(join(empty, "vincentius-marketplace.installed.json")), false);
  });

  it("never overwrites a file the kit does not own", () => {
    const other = fresh();
    mkdirSync(join(other, "skills", "grilling"), { recursive: true });
    writeFileSync(join(other, "skills", "grilling", "SKILL.md"), "my own grilling skill");
    const result = install(other);
    assert.equal(result.status, 1);
    assert.equal(readFileSync(join(other, "skills", "grilling", "SKILL.md"), "utf8"), "my own grilling skill");
    assert.match(result.stdout, /skills\/grilling\/SKILL\.md exists and is not the kit's/);
  });

  it("removes a file that left the kit, and nothing else", () => {
    const other = fresh();
    install(other);
    const manifest = manifestOf(other);
    mkdirSync(join(other, "skills", "retired"), { recursive: true });
    writeFileSync(join(other, "skills", "retired", "SKILL.md"), "old");
    writeFileSync(join(other, "skills", "mine.md"), "the user's own file");
    manifest.files.push("skills/retired/SKILL.md");
    writeFileSync(join(other, "vincentius-marketplace.installed.json"), JSON.stringify(manifest));
    install(other);
    assert.equal(existsSync(join(other, "skills", "retired", "SKILL.md")), false);
    assert.equal(readFileSync(join(other, "skills", "mine.md"), "utf8"), "the user's own file");
  });

  it("uninstalls exactly the manifest's files", () => {
    const other = fresh();
    install(other);
    writeFileSync(join(other, "keep-me.txt"), "mine");
    assert.equal(install(other, "--uninstall").status, 0);
    assert.equal(existsSync(join(other, "rules", "tv", "core.md")), false);
    assert.equal(existsSync(join(other, "vincentius-marketplace.installed.json")), false);
    assert.equal(readFileSync(join(other, "keep-me.txt"), "utf8"), "mine");
  });

  describe("--apply-settings", () => {
    it("merges the hooks with the target's own paths, keeping existing entries", () => {
      const other = fresh();
      writeFileSync(join(other, "settings.json"), JSON.stringify({ theme: "dark", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }));
      assert.equal(install(other, "--apply-settings").status, 0);
      const settings = JSON.parse(readFileSync(join(other, "settings.json"), "utf8"));
      assert.equal(settings.theme, "dark");
      const stopCommands = settings.hooks.Stop.flatMap((e) => e.hooks.map((h) => [h.command, ...(h.args || [])].join(" ")));
      assert.ok(stopCommands.includes("echo mine"));
      assert.ok(stopCommands.some((c) => c.includes(`${other.split("\\").join("/")}/hooks/tv/std-check-gate.js`)));
      assert.ok(readdirSync(other).some((f) => f.startsWith("settings.json.bak-")));
    });

    it("is idempotent: the second run neither writes nor backs up", () => {
      const other = fresh();
      install(other, "--apply-settings");
      const backups = () => readdirSync(other).filter((f) => f.startsWith("settings.json.bak-")).length;
      const before = backups();
      const result = install(other, "--apply-settings");
      assert.match(result.stdout, /already has everything/);
      assert.equal(backups(), before);
      const settings = JSON.parse(readFileSync(join(other, "settings.json"), "utf8"));
      assert.equal(settings.hooks.PreToolUse.length, 2);
    });

    it("adds the personal permissions only with --personal", () => {
      const plain = fresh();
      install(plain, "--apply-settings");
      assert.equal(JSON.parse(readFileSync(join(plain, "settings.json"), "utf8")).permissions, undefined);
      const personal = fresh();
      install(personal, "--apply-settings", "--personal");
      assert.ok(JSON.parse(readFileSync(join(personal, "settings.json"), "utf8")).permissions.deny.includes("Bash(git push -f *)"));
    });
  });

  it("works on another machine's config dir with no personal files", () => {
    const other = fresh();
    install(other);
    assert.equal(existsSync(join(other, "CLAUDE.md")), false);
    assert.equal(existsSync(join(other, "CLAUDE.md.from-kit")), false);
  });
});
