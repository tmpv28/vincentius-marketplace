import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runHook, EM_DASH } from "./helpers.mjs";

const notice = (toolInput) => runHook("em-dash-notice.js", { tool_name: "Edit", tool_input: toolInput }).stdout;

describe("em-dash-notice.js", () => {
  it("adds context when an em-dash is written into a code file", () => {
    assert.match(notice({ file_path: "src/a.ts", new_string: `// load ${EM_DASH} then parse` }), /00 #5/);
  });

  it("covers stylesheets and C++ too", () => {
    assert.match(notice({ file_path: "a.scss", content: `/* a ${EM_DASH} b */` }), /em-dash/);
    assert.match(notice({ file_path: "main.cpp", content: `// a ${EM_DASH} b` }), /em-dash/);
  });

  it("stays silent for long-form prose, where 00 #5 allows them", () => {
    assert.equal(notice({ file_path: "docs/guide.md", content: `A ${EM_DASH} B` }), "");
  });

  it("stays silent when the code has no em-dash", () => {
    assert.equal(notice({ file_path: "src/a.ts", new_string: "// load, then parse" }), "");
  });
});
