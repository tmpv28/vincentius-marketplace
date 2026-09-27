import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runHook, makeTempDir, makePackage } from "./helpers.mjs";

// Every run uses its own config dir, so markers never touch a real ~/.claude.
const env = { CLAUDE_CONFIG_DIR: makeTempDir("gate-config") };
const failing = makePackage("gate-fail", 'node -e "process.exit(1)"');
const passing = makePackage("gate-pass", 'node -e "process.exit(0)"');
const noGate = makePackage("gate-none", null);

let sessionCounter = 0;
const newSession = () => `session-${++sessionCounter}`;
const mark = (sessionId, cwd) => runHook("edit-marker.js", { session_id: sessionId, cwd, tool_name: "Edit" }, env);
const stop = (sessionId, cwd, stopHookActive = false) =>
  runHook("std-check-gate.js", { session_id: sessionId, cwd, stop_hook_active: stopHookActive }, env);

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

  it("consumes the marker, so the next stop is silent", () => {
    const id = newSession();
    mark(id, failing);
    stop(id, failing);
    assert.equal(stop(id, failing).status, 0);
  });

  it("lets the stop through when std:check passes", () => {
    const id = newSession();
    mark(id, passing);
    assert.equal(stop(id, passing).status, 0);
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
});
