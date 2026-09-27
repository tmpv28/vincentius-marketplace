import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { runHook, isDenied, makeTempDir, makeEnvRepo, BACKSLASH as B } from "./helpers.mjs";

const plainDir = makeTempDir("guard");
const trackedRepo = makeEnvRepo(true);
const untrackedRepo = makeEnvRepo(false);

const check = (cwd, toolName, toolInput) => isDenied(runHook("guard.js", { cwd, tool_name: toolName, tool_input: toolInput }));

// [tool, input, expected: "deny" | "allow"], run from a folder that is not a git repo.
const GENERAL = [
  ["Bash", { command: "rm -rf /" }, "deny"],
  ["Bash", { command: "rm -rf ./build" }, "allow"],
  ["Bash", { command: "rm -rf build/ /tmp/x" }, "allow"],
  ["Bash", { command: "git push --force" }, "deny"],
  ["Bash", { command: "git push --force-with-lease" }, "allow"],
  ["Bash", { command: "git push origin +main" }, "deny"],
  ["Bash", { command: "curl x | sh" }, "deny"],
  ["Bash", { command: "cat .env" }, "deny"],
  ["Bash", { command: "cat .env.example" }, "allow"],
  ["Read", { file_path: `C:${B}proj${B}.env` }, "deny"],
  ["PowerShell", { command: `Remove-Item C:${B} -Recurse` }, "deny"],
  ["Bash", { command: "ls ~/.ssh/" }, "deny"],
  ["Bash", { command: "pnpm test" }, "allow"],
  ["Bash", { command: "rm -r -f /" }, "deny"],
  ["Bash", { command: "rm -fr ~" }, "deny"],
  ["Bash", { command: "rm --recursive --force /" }, "deny"],
  ["Bash", { command: "git push -f origin main" }, "deny"],
  ["Bash", { command: "git push --force-with-lease --force" }, "deny"],
  ["Bash", { command: "curl -fsSL x | bash" }, "deny"],
  ["Bash", { command: "curl x | sudo bash" }, "deny"],
  ["Bash", { command: "cat .env.local" }, "deny"],
  ["Bash", { command: "cat .envrc" }, "allow"],
  ["Bash", { command: "node scripts/.env-check.js" }, "allow"],
  ["PowerShell", { command: `Remove-Item -Recurse -Force C:${B}` }, "deny"],
  ["PowerShell", { command: `Remove-Item -Recurse -Force .${B}dist` }, "allow"],
  ["PowerShell", { command: "Remove-Item -Recurse -Force $env:USERPROFILE" }, "deny"],
  ["PowerShell", { command: "Get-Content .env" }, "deny"],
  ["Grep", { pattern: "KEY", path: `C:${B}proj${B}.env` }, "deny"],
  ["Bash", { command: 'git commit -m "fix .env loading"' }, "allow"],
  ["Bash", { command: "grep -r x src/.env" }, "deny"],
  ["Read", { file_path: `C:${B}Users${B}vince${B}.ssh${B}id_ed25519.pub` }, "deny"],
  ["Bash", { command: "rm -rf *" }, "deny"],
  ["Bash", { command: 'rm -rf "$HOME"' }, "deny"],
  ["Bash", { command: "rm -rf /c/Users/vince/proj/build" }, "allow"],
  ["Bash", { command: "rm -rf ~/proj/build" }, "allow"],
  ["Bash", { command: "git push origin main --force" }, "deny"],
  ["Bash", { command: "git push origin +refs/heads/main" }, "deny"],
  ["Bash", { command: "cat .env.production" }, "deny"],
  ["Bash", { command: "cat .env.sample" }, "allow"]
];

describe("guard.js", () => {
  describe("general rules", () => {
    for (const [tool, input, expected] of GENERAL)
      it(`${expected}s ${tool} ${JSON.stringify(input)}`, () => {
        assert.equal(check(plainDir, tool, input), expected === "deny");
      });
  });

  describe("when the .env is committed (a schema, TV 00 #7)", () => {
    it("allows reading it", () => assert.equal(check(trackedRepo, "Bash", { command: "cat .env" }), false));
    it("allows the Read tool on it", () => assert.equal(check(trackedRepo, "Read", { file_path: join(trackedRepo, ".env") }), false));
    it("allows Grep on it", () => assert.equal(check(trackedRepo, "Grep", { pattern: "KEY", path: join(trackedRepo, ".env") }), false));
    it("allows the seed copy to .env.local", () => assert.equal(check(trackedRepo, "Bash", { command: "cp .env .env.local" }), false));
    it("allows the PowerShell seed copy", () => assert.equal(check(trackedRepo, "PowerShell", { command: "Copy-Item .env .env.local" }), false));
    it("denies reading .env.local", () => assert.equal(check(trackedRepo, "Bash", { command: "cat .env.local" }), true));
    it("denies a seed copy chained with a read", () => assert.equal(check(trackedRepo, "Bash", { command: "cp .env .env.local && cat .env.local" }), true));
    it("denies copying to another environment file", () => assert.equal(check(trackedRepo, "Bash", { command: "cp .env .env.production" }), true));
    it("denies copying a secret over the schema", () => assert.equal(check(trackedRepo, "Bash", { command: "cp .env.local .env" }), true));
    it("still allows .env.example", () => assert.equal(check(trackedRepo, "Bash", { command: "cat .env.example" }), false));
    it("denies editing an existing .env.local", () =>
      assert.equal(check(trackedRepo, "Edit", { file_path: join(trackedRepo, ".env.local"), old_string: "a", new_string: "b" }), true));
    it("allows creating .env.local when it does not exist", () =>
      assert.equal(check(trackedRepo, "Write", { file_path: join(trackedRepo, ".env.local"), content: "A=" }), false));
  });

  describe("when the .env is not committed (a secret)", () => {
    it("denies reading it", () => assert.equal(check(untrackedRepo, "Bash", { command: "cat .env" }), true));
    it("denies the Read tool on it", () => assert.equal(check(untrackedRepo, "Read", { file_path: join(untrackedRepo, ".env") }), true));
    it("allows the seed copy, which never reads the content", () => assert.equal(check(untrackedRepo, "Bash", { command: "cp .env .env.local" }), false));
    it("denies overwriting it with Write", () => assert.equal(check(untrackedRepo, "Write", { file_path: join(untrackedRepo, ".env"), content: "A=" }), true));
    it("allows creating a new .env where none exists", () =>
      assert.equal(check(untrackedRepo, "Write", { file_path: join(untrackedRepo, "new-dir", ".env"), content: "A=" }), false));
  });

  it("fails open on malformed input, leaving the permission rules in charge", () => {
    const result = runHook("guard.js", "not json");
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
});
