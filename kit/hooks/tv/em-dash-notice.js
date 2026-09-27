// PostToolUse on Edit|Write|MultiEdit|NotebookEdit: 00 #5 bans em-dashes in code-adjacent text.
// A notice, not a block: long-form docs may use them, and the template's std:check is the gate.
const { CODE_ADJACENT_FILE } = require("./code-extensions.js");

// By code point, because an editor can turn an escape back into the character this file bans.
const EM_DASH = String.fromCharCode(0x2014);

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let toolInput = {};
  try { toolInput = JSON.parse(raw)?.tool_input || {}; } catch { process.exit(0); }
  const filePath = toolInput.file_path || toolInput.notebook_path || "";
  if (typeof filePath !== "string" || !CODE_ADJACENT_FILE.test(filePath)) process.exit(0);

  const multiEditStrings = Array.isArray(toolInput.edits) ? toolInput.edits.map((edit) => edit?.new_string) : [];
  const written = [toolInput.content, toolInput.new_string, toolInput.new_source, ...multiEditStrings]
    .filter((text) => typeof text === "string")
    .join("\n");
  if (!written.includes(EM_DASH)) process.exit(0);

  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse",
    additionalContext: `An em-dash was written into ${filePath}. 00 #5 bans them in code-adjacent text; replace it with a period, semicolon or colon.` } }));
});
