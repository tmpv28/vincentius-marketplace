import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runHook, isDenied, makeTempDir, EM_DASH, REPO } from "./helpers.mjs";

const messageDir = makeTempDir("commit-messages");
writeFileSync(join(messageDir, "bad.txt"), "Fixed stuff.\n");
mkdirSync(join(messageDir, "sub"));
writeFileSync(join(messageDir, "sub", "msg.txt"), "Fixed stuff.\n");
writeFileSync(join(messageDir, "good.txt"), "\nfeat(api): add read controller\n\nBody explains why.\n");

const heredoc = (message) => `git commit -m "$(cat <<'EOF'\n${message}\nEOF\n)"`;
const check = (command) => isDenied(runHook("commit-guard.js", { cwd: messageDir, tool_name: "Bash", tool_input: { command } }));

const CASES = [
  ['git commit -m "Fixed stuff."', "deny"],
  ['git commit -m "fix(notes): gate archive action by permission"', "allow"],
  ['git commit -m "[marketplace] split react pack out of 04"', "allow"],
  [heredoc("Fixed stuff."), "deny"],
  [heredoc("feat(api): add read controller\n\nBody explains why."), "allow"],
  [heredoc(`feat(api): add read controller ${EM_DASH} and more`), "deny"],
  [heredoc("chore: " + "x".repeat(101)), "deny"],
  [heredoc("fix: trailing period."), "deny"],
  ["git add . && " + heredoc("refactor(commons): extract isNullOrEmpty"), "allow"],
  ["git commit --amend --no-edit", "allow"],
  ["git commit", "allow"],
  ["git status", "allow"],
  ['git commit -m "feat!: drop node 18"', "allow"],
  ["git commit -m 'docs(readme): explain install'", "allow"]
];

// Finding 8: every way git accepts a message, behind every prefix git accepts.
const PARSING = [
  ['git commit -am "Fixed stuff."', "deny"],
  ['git commit -am "fix: stage and commit"', "allow"],
  ["git commit -m'Fixed stuff.'", "deny"],
  ['git commit --message="Fixed stuff."', "deny"],
  ['git commit --message "fix: long option with a separate value"', "allow"],
  ['git commit -m "fix: subject" -m "Body sentence ends with a period."', "allow"],
  [`git commit -m "fix: subject" -m "Body ${EM_DASH} with an em-dash."`, "deny"],
  ['git -C repo commit -m "Fixed stuff."', "deny"],
  ['git -c user.name=x commit -m "Fixed stuff."', "deny"],
  ['GIT_AUTHOR_NAME=x git --no-pager commit -m "Fixed stuff."', "deny"],
  ["git commit -F- <<'EOF'\nFixed stuff.\nEOF", "deny"],
  ["git commit -F - <<'EOF'\nfix: from stdin\nEOF", "allow"],
  ["git commit --file=- <<'EOF'\nFixed stuff.\nEOF", "deny"],
  ["cat > notes.md <<'EOF'\nFixed stuff.\nEOF\ngit commit -m \"fix: unrelated heredoc first\"", "allow"],
  ["cat > notes.md <<'EOF'\nfix: looks fine\nEOF\ngit commit -m \"Fixed stuff.\"", "deny"],
  ["git commit -F bad.txt", "deny"],
  ["git commit -F good.txt", "allow"],
  ["git commit -F missing.txt", "allow"],
  ['git commit -m "$MSG"', "allow"],
  [heredoc("\n\nFixed stuff."), "deny"],
  [heredoc("\nfix: leading blank line"), "allow"],
  [heredoc("fix: subject wraps\nonto a second line that makes the first paragraph run past one hundred characters in total"), "deny"]
];

// Pass 2: long-option abbreviations as git reads them, and -C moving where -F looks.
const ABBREVIATIONS_AND_WORK_DIRS = [
  ['git commit --mess="Fixed stuff."', "deny"],
  ['git commit --mes "Fixed stuff."', "deny"],
  ['git commit --m "fix: shortest unambiguous prefix"', "allow"],
  ["git commit --fil=bad.txt", "deny"],
  ["git commit --fi bad.txt", "allow"],
  ["git -C sub commit -F msg.txt", "deny"],
  ["git commit -F msg.txt", "allow"]
];

// Pass 2: the same rules through the PowerShell tool, here-strings included.
const POWERSHELL = [
  ['git commit -m "Fixed stuff."', "deny"],
  ["git commit -m @'\nfix(hooks): x\n'@", "allow"],
  ["git commit -m @'\nFixed stuff.\n'@", "deny"],
  ['git commit -m @"\nfix(hooks): $scope\n"@', "allow"],
  ["git commit -m 'docs(readme): single quotes'", "allow"],
  ["git commit -m \"fix: y`n`nLonger body text that explains why it changed here.\"", "allow"]
];

const runCases = (cases, toolName = "Bash") => {
  for (const [command, expected] of cases)
    it(`${expected === "deny" ? "denies" : "allows"} ${toolName} ${JSON.stringify(command).slice(0, 70)}`, () => {
      assert.equal(isDenied(runHook("commit-guard.js", { cwd: messageDir, tool_name: toolName, tool_input: { command } })), expected === "deny");
    });
};

describe("commit-guard.js", () => {
  runCases(CASES);

  describe("when the message arrives through options, files or stdin", () => runCases(PARSING));
  describe("when an option is abbreviated or git runs in another folder", () => runCases(ABBREVIATIONS_AND_WORK_DIRS));
  describe("when the command comes from the PowerShell tool", () => runCases(POWERSHELL, "PowerShell"));

  it("runs for PowerShell as well as Bash, per hooks.snippet.json", () => {
    const snippet = JSON.parse(readFileSync(join(REPO, "kit", "settings", "hooks.snippet.json"), "utf8"));
    const entry = snippet.hooks.PreToolUse.find((candidate) => candidate.hooks.some((hook) => hook.args.some((arg) => arg.endsWith("commit-guard.js"))));
    assert.deepEqual(entry.matcher.split("|").sort(), ["Bash", "PowerShell"]);
  });

  it("names every problem in the reason", () => {
    const result = runHook("commit-guard.js", { tool_name: "Bash", tool_input: { command: heredoc("Fixed stuff.") } });
    assert.match(result.stdout, /"TV 11: /);
    assert.match(result.stdout, /prefix/);
    assert.match(result.stdout, /period/);
  });

  it("fails open on malformed input", () => {
    assert.equal(runHook("commit-guard.js", "not json").stdout, "");
  });
});
