import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { runKitScript, REPO } from "./helpers.mjs";

const statusLine = (input) => runKitScript(join(REPO, "kit", "statusline.js"), input);

describe("statusline.js", () => {
  it("shows the model, context and five-hour usage", () => {
    const input = { model: { display_name: "Opus" }, context_window: { used_percentage: 41.6 }, rate_limits: { five_hour: { used_percentage: 12 } } };
    assert.equal(statusLine(input).stdout, "Opus · ctx 42% · 5h 12%");
  });

  it("reads percentages that arrive as strings", () => {
    assert.equal(statusLine({ model: { id: "opus" }, context_window: { used_percentage: "7.4" } }).stdout, "opus · ctx 7%");
  });

  it("survives null input and null nested fields", () => {
    assert.equal(statusLine("null").stdout, "Claude");
    assert.equal(statusLine({ model: null, context_window: null, rate_limits: { five_hour: null } }).stdout, "Claude");
  });

  it("drops a percentage that is null or not a number rather than printing 0%", () => {
    assert.equal(statusLine({ context_window: { used_percentage: null }, rate_limits: { five_hour: { used_percentage: "n/a" } } }).stdout, "Claude");
  });

  it("fails open on malformed input", () => {
    const result = statusLine("not json");
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
});
