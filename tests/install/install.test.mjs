import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const install = (target, ...flags) => spawnSync(process.execPath, [join(REPO, "install.mjs"), ...flags],
  { env: { ...process.env, CLAUDE_CONFIG_DIR: target, CLAUDE_PLUGIN_ROOT: "" }, encoding: "utf8" });
const installFrom = (cwd, configDir, ...flags) => spawnSync(process.execPath, [join(REPO, "install.mjs"), ...flags],
  { cwd, env: { ...process.env, CLAUDE_CONFIG_DIR: configDir }, encoding: "utf8" });
const settingsOf = (target) => JSON.parse(readFileSync(join(target, "settings.json"), "utf8"));
const commandsOf = (groups = []) => groups.flatMap((g) => g.hooks.map((h) => [h.command, ...(h.args || [])].join(" ")));
const backupsOf = (dir, name) => readdirSync(dir).filter((f) => f.startsWith(`${name}.bak-`));
const created = [];
const fresh = () => { const dir = mkdtempSync(join(tmpdir(), "vm-install-")); created.push(dir); return dir; };
after(() => { for (const dir of created) rmSync(dir, { recursive: true, force: true }); });
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
      const files = Object.keys(manifestOf(target).files);
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
      assert.match(Object.values(manifest.files)[0], /^[0-9a-f]{64}$/);
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
    manifest.files["skills/retired/SKILL.md"] = null;
    writeFileSync(join(other, "vincentius-marketplace.installed.json"), JSON.stringify(manifest));
    install(other);
    assert.equal(existsSync(join(other, "skills", "retired", "SKILL.md")), false);
    assert.equal(readFileSync(join(other, "skills", "mine.md"), "utf8"), "the user's own file");
    assert.equal(existsSync(join(other, "skills", "retired")), false);
  });

  it("backs up a kit file you edited before an update replaces it", () => {
    const other = fresh();
    install(other);
    const core = join(other, "rules", "tv", "core.md");
    writeFileSync(core, readFileSync(core, "utf8") + "\nmy note\n");
    const result = install(other);
    assert.equal(result.status, 0);
    assert.doesNotMatch(readFileSync(core, "utf8"), /my note/);
    const [kept] = backupsOf(join(other, "rules", "tv"), "core.md");
    assert.match(readFileSync(join(other, "rules", "tv", kept), "utf8"), /my note/);
  });

  it("backs up a file it takes over with --force", () => {
    const other = fresh();
    mkdirSync(join(other, "skills", "grilling"), { recursive: true });
    writeFileSync(join(other, "skills", "grilling", "SKILL.md"), "my own grilling skill");
    assert.equal(install(other, "--force").status, 0);
    const [kept] = backupsOf(join(other, "skills", "grilling"), "SKILL.md");
    assert.equal(readFileSync(join(other, "skills", "grilling", kept), "utf8"), "my own grilling skill");
  });

  it("records the plugin route when the setup skill says so", () => {
    const other = fresh();
    install(other, "--route=plugin");
    assert.equal(manifestOf(other).route, "plugin");
  });

  it("uninstalls exactly the manifest's files", () => {
    const other = fresh();
    install(other);
    writeFileSync(join(other, "keep-me.txt"), "mine");
    assert.equal(install(other, "--uninstall").status, 0);
    assert.equal(existsSync(join(other, "rules", "tv", "core.md")), false);
    assert.equal(existsSync(join(other, "vincentius-marketplace.installed.json")), false);
    assert.equal(readFileSync(join(other, "keep-me.txt"), "utf8"), "mine");
    assert.equal(existsSync(join(other, "rules")), false);
  });

  it("keeps a backup of an edited file it uninstalls", () => {
    const other = fresh();
    install(other);
    const agent = join(other, "agents", "tv-mechanical.md");
    writeFileSync(agent, "my version");
    install(other, "--uninstall");
    assert.equal(existsSync(agent), false);
    const [kept] = backupsOf(join(other, "agents"), "tv-mechanical.md");
    assert.equal(readFileSync(join(other, "agents", kept), "utf8"), "my version");
  });

  it("removes its hooks and status line from settings.json on uninstall, and only those", () => {
    const other = fresh();
    writeFileSync(join(other, "settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }));
    install(other, "--apply-settings");
    install(other, "--uninstall");
    const settings = settingsOf(other);
    assert.deepEqual(commandsOf(settings.hooks.Stop), ["echo mine"]);
    assert.equal(settings.hooks.PreToolUse, undefined);
    assert.equal(settings.statusLine, undefined);
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

    it("treats another spelling of the same config dir as the same hooks", () => {
      const other = fresh();
      install(other, "--apply-settings");
      install(other + "/", "--apply-settings");
      assert.equal(settingsOf(other).hooks.PreToolUse.length, 2);
    });

    it("writes absolute hook paths for a relative config dir", () => {
      const parent = fresh();
      installFrom(parent, "rel", "--apply-settings");
      const [command] = commandsOf(settingsOf(join(parent, "rel")).hooks.Stop);
      assert.ok(command.includes(`${parent.split("\\").join("/")}/rel/hooks/tv/std-check-gate.js`), command);
    });

    it("keeps a hook you added in the same group as a kit hook", () => {
      const other = fresh();
      install(other, "--apply-settings");
      const settings = settingsOf(other);
      settings.hooks.Stop[0].hooks.push({ type: "command", command: "echo user-added" });
      writeFileSync(join(other, "settings.json"), JSON.stringify(settings));
      install(other, "--apply-settings");
      assert.ok(commandsOf(settingsOf(other).hooks.Stop).includes("echo user-added"));
    });

    it("keeps your status line and says so", () => {
      const other = fresh();
      writeFileSync(join(other, "settings.json"), JSON.stringify({ statusLine: { type: "command", command: "my-line" } }));
      const result = install(other, "--apply-settings");
      assert.equal(settingsOf(other).statusLine.command, "my-line");
      assert.match(result.stdout, /kept your own value for: statusLine/);
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
