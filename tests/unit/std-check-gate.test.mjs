import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runHook, makeTempDir, makePackage, REPO } from "./helpers.mjs";

// Every run uses its own config dir, so markers never touch a real ~/.claude.
const configDir = makeTempDir("gate-config");
const env = { CLAUDE_CONFIG_DIR: configDir };
const LOCAL_SCRIPT = "node scripts/std-check.js";
const failing = makePackage("gate-fail", LOCAL_SCRIPT, { "scripts/std-check.js": "process.exit(1);\n" });
const passing = makePackage("gate-pass", LOCAL_SCRIPT, { "scripts/std-check.js": "process.exit(0);\n" });
const slow = makePackage("gate-slow", LOCAL_SCRIPT, { "scripts/std-check.js": "setTimeout(() => {}, 20000);\n" });
const noGate = makePackage("gate-none", null);
const foreignCommand = makePackage("gate-foreign", 'node -e "process.exit(1)"');
const chainedCommand = makePackage("gate-chained", `${LOCAL_SCRIPT} && node -e "process.exit(1)"`, { "scripts/std-check.js": "process.exit(0);\n" });
const withPreScript = makePackage("gate-pre", null, {
  "package.json": JSON.stringify({ scripts: { "prestd:check": `node -e "require('fs').writeFileSync('pre-ran.txt', '')"`, "std:check": LOCAL_SCRIPT } }),
  "scripts/std-check.js": "process.exit(0);\n"
});
const withArgs = makePackage("gate-args", `${LOCAL_SCRIPT} --strict fast`, {
  "scripts/std-check.js": 'process.exit(process.argv.slice(2).join(" ") === "--strict fast" ? 0 : 1);\n'
});
const brokenPackage =makePackage("gate-broken", null, { "package.json": "{ not json" });

let sessionCounter = 0;
const newSession = () => `session-${++sessionCounter}`;
const markerFile = (sessionId) => join(configDir, "state", "tv-edited", sessionId);
const mark = (sessionId, cwd, filePath) =>
  runHook("edit-marker.js", { session_id: sessionId, cwd, tool_name: "Edit", tool_input: filePath ? { file_path: filePath } : {} }, env);
const stop = (sessionId, cwd, stopHookActive = false, extraEnv = {}) =>
  runHook("std-check-gate.js", { session_id: sessionId, cwd, stop_hook_active: stopHookActive }, { ...env, ...extraEnv });

describe("std-check-gate.js", () => {
  it("does nothing when Claude edited nothing this turn", () => {
    assert.equal(stop(newSession(), failing).status, 0);
  });

  it("blocks the stop when Claude edited and std:check fails", () => {
    const id = newSession();
    mark(id, failing);
    const result = stop(id, failing);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /std:check failed/);
  });

  it("runs the script with node directly, so a prestd:check script never runs", () => {
    const id = newSession();
    mark(id, withPreScript);
    assert.equal(stop(id, withPreScript).status, 0);
    assert.equal(existsSync(join(withPreScript, "pre-ran.txt")), false);
  });

  it("passes the script's arguments through", () => {
    const id = newSession();
    mark(id, withArgs);
    assert.equal(stop(id, withArgs).status, 0);
  });

  it("keeps the marker after a block, so the forced retry is checked and reported", () => {
    const id = newSession();
    mark(id, failing);
    assert.equal(stop(id, failing).status, 2);
    const retry = stop(id, failing, true);
    assert.equal(retry.status, 0);
    assert.match(retry.stdout, /still failing/);
    assert.equal(stop(id, failing).status, 0);
  });

  it("lets the stop through when std:check passes, and consumes the marker", () => {
    const id = newSession();
    mark(id, passing);
    assert.equal(stop(id, passing).status, 0);
    assert.equal(existsSync(markerFile(id)), false);
  });

  it("stays silent in a project without a std:check script", () => {
    const id = newSession();
    mark(id, noGate);
    assert.equal(stop(id, noGate).status, 0);
  });

  it("does not block a second time, and tells the user it is not done", () => {
    const id = newSession();
    mark(id, failing);
    const result = stop(id, failing, true);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /still failing/);
  });

  it("stays silent after the forced retry when the fix worked", () => {
    const id = newSession();
    mark(id, passing);
    const result = stop(id, passing, true);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });

  it("never gates a session for another session's edit", () => {
    mark(newSession(), failing);
    assert.equal(stop(newSession(), failing).status, 0);
  });

  it("fails open on malformed input", () => {
    assert.equal(runHook("std-check-gate.js", "not json", env).status, 0);
  });

  describe("when the edited file lives in another project", () => {
    it("checks the edited file's project, not the session's cwd", () => {
      const id = newSession();
      mark(id, passing, join(failing, "src", "a.ts"));
      assert.equal(stop(id, passing).status, 2);
    });

    it("records every project edited in the session", () => {
      const id = newSession();
      mark(id, passing, join(passing, "a.ts"));
      mark(id, passing, join(failing, "b.ts"));
      assert.deepEqual(JSON.parse(readFileSync(markerFile(id), "utf8")).projectDirs, [passing, failing]);
      assert.equal(stop(id, passing).status, 2);
    });

    it("records the project of a MultiEdit, which the marker runs for", () => {
      const id = newSession();
      runHook("edit-marker.js", { session_id: id, cwd: passing, tool_name: "MultiEdit", tool_input: { file_path: join(failing, "c.ts"), edits: [] } }, env);
      assert.equal(stop(id, passing).status, 2);
      const snippet = JSON.parse(readFileSync(join(REPO, "kit", "settings", "hooks.snippet.json"), "utf8"));
      const entry = snippet.hooks.PostToolUse.find((candidate) => candidate.hooks.some((hook) => hook.args.some((arg) => arg.endsWith("edit-marker.js"))));
      assert.ok(entry.matcher.split("|").includes("MultiEdit"));
    });

    it("falls back to cwd for a marker in the old bare-string format", () => {
      const id = newSession();
      mkdirSync(join(configDir, "state", "tv-edited"), { recursive: true });
      writeFileSync(markerFile(id), passing);
      assert.equal(stop(id, failing).status, 2);
    });
  });

  describe("when std:check is not the repo's own node script", () => {
    it("skips a std:check that runs anything else", () => {
      const id = newSession();
      mark(id, foreignCommand);
      assert.equal(stop(id, foreignCommand).status, 0);
    });

    it("skips a local script chained with another command", () => {
      const id = newSession();
      mark(id, chainedCommand);
      assert.equal(stop(id, chainedCommand).status, 0);
    });

    it("recognises this repo's own std:check", () => {
      const script = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).scripts["std:check"];
      assert.match(script, /^node\s+(\.\/)?scripts\/[\w.-]+\.(c|m)?js$/);
    });

    it("says so when package.json cannot be parsed, without blocking", () => {
      const id = newSession();
      mark(id, brokenPackage);
      const result = stop(id, brokenPackage);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /could not be parsed/);
    });
  });

  it("blocks with a timeout message when std:check runs out of time", () => {
    const id = newSession();
    mark(id, slow);
    const result = stop(id, slow, false, { TV_STD_CHECK_BUDGET_MS: "3000" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /timed out/);
  });

  describe("when the session id is not a plain name", () => {
    it("never writes a marker outside the state folder", () => {
      mark("../escaped", failing);
      assert.equal(existsSync(join(configDir, "state", "escaped")), false);
      assert.equal(existsSync(markerFile("escaped")), true);
    });

    it("ignores an id made only of dots", () => {
      assert.equal(mark("..", failing).status, 0);
      assert.equal(stop("..", failing).status, 0);
    });
  });

  it("gives the Stop hook the 600s timeout the gate's own budget sits under", () => {
    const snippet = JSON.parse(readFileSync(join(REPO, "kit", "settings", "hooks.snippet.json"), "utf8"));
    assert.equal(snippet.hooks.Stop[0].hooks[0].timeout, 600);
  });
});
