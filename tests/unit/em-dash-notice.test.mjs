import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runHook, EM_DASH, REPO } from "./helpers.mjs";

const notice = (toolInput, toolName = "Edit") => runHook("em-dash-notice.js", { tool_name: toolName, tool_input: toolInput }).stdout;

describe("em-dash-notice.js", () => {
  it("adds context when an em-dash is written into a code file", () => {
    assert.match(notice({ file_path: "src/a.ts", new_string: `// load ${EM_DASH} then parse` }), /TV 00 #5/);
  });

  it("covers stylesheets and C++ too", () => {
    assert.match(notice({ file_path: "a.scss", content: `/* a ${EM_DASH} b */` }), /em-dash/);
    assert.match(notice({ file_path: "main.cpp", content: `// a ${EM_DASH} b` }), /em-dash/);
  });

  it("covers the web framework and config files in the shared list", () => {
    for (const filePath of ["App.vue", "Page.svelte", "index.astro", "ci.yml", "compose.yaml", "a.mts", "b.cts", "package.json"])
      assert.match(notice({ file_path: filePath, content: `a ${EM_DASH} b` }), /em-dash/, filePath);
  });

  it("reads every edit of a MultiEdit", () => {
    const edits = [{ old_string: "a", new_string: "fine" }, { old_string: "b", new_string: `x ${EM_DASH} y` }];
    assert.match(notice({ file_path: "src/a.ts", edits }, "MultiEdit"), /em-dash/);
  });

  it("reads the new cell source of a NotebookEdit", () => {
    assert.match(notice({ notebook_path: "analysis.ipynb", new_source: `# a ${EM_DASH} b` }, "NotebookEdit"), /em-dash/);
  });

  it("reads an em-dash whose bytes straddle the 64 KiB stdin chunk boundary", () => {
    const head = `{"tool_name":"Write","tool_input":{"file_path":"a.ts","content":"`;
    const input = `${head}${"x".repeat(65534 - Buffer.byteLength(head))}${EM_DASH}"}}`;
    assert.equal(Buffer.byteLength(input.slice(0, input.indexOf(EM_DASH))), 65534);
    assert.match(runHook("em-dash-notice.js", input).stdout, /em-dash/);
  });

  it("stays silent for long-form prose, where TV 00 #5 allows them", () => {
    assert.equal(notice({ file_path: "docs/guide.md", content: `A ${EM_DASH} B` }), "");
  });

  it("stays silent when the code has no em-dash", () => {
    assert.equal(notice({ file_path: "src/a.ts", new_string: "// load, then parse" }), "");
  });

  it("runs after MultiEdit and NotebookEdit as well as Edit and Write", () => {
    const snippet = JSON.parse(readFileSync(join(REPO, "kit", "settings", "hooks.snippet.json"), "utf8"));
    const entry = snippet.hooks.PostToolUse.find((candidate) => candidate.hooks.some((hook) => hook.args.some((arg) => arg.endsWith("em-dash-notice.js"))));
    assert.deepEqual(entry.matcher.split("|").sort(), ["Edit", "MultiEdit", "NotebookEdit", "Write"]);
  });

  it("shares its list of code files with scripts/std-check.mjs", () => {
    assert.match(readFileSync(join(REPO, "scripts", "std-check.mjs"), "utf8"), /code-extensions\.js/);
  });
});
