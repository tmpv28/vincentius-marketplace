import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runHook, isDenied, EM_DASH } from "./helpers.mjs";

const heredoc = (message) => `git commit -m "$(cat <<'EOF'\n${message}\nEOF\n)"`;
const check = (command) => isDenied(runHook("commit-guard.js", { tool_name: "Bash", tool_input: { command } }));

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

describe("commit-guard.js", () => {
  for (const [command, expected] of CASES)
    it(`${expected}s ${JSON.stringify(command).slice(0, 70)}`, () => {
      assert.equal(check(command), expected === "deny");
    });

  it("names every problem in the reason", () => {
    const result = runHook("commit-guard.js", { tool_name: "Bash", tool_input: { command: heredoc("Fixed stuff.") } });
    assert.match(result.stdout, /prefix/);
    assert.match(result.stdout, /period/);
  });
});
