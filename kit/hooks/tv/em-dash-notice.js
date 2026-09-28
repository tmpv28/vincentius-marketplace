// PostToolUse on Edit|Write|MultiEdit|NotebookEdit: TV 00 #5 bans em-dashes in code-adjacent text.
// A notice, not a block: long-form docs may use them, and the template's std:check is the gate.
const { CODE_ADJACENT_FILE, EM_DASH } = require("./code-extensions.js");
const { readInput } = require("./hook-input.js");

readInput().then((input) => {
  if (!input) process.exit(0);
  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path || toolInput.notebook_path || "";
  if (typeof filePath !== "string" || !CODE_ADJACENT_FILE.test(filePath)) process.exit(0);

  const multiEditStrings = Array.isArray(toolInput.edits) ? toolInput.edits.map((edit) => edit?.new_string) : [];
  const written = [toolInput.content, toolInput.new_string, toolInput.new_source, ...multiEditStrings]
    .filter((text) => typeof text === "string")
    .join("\n");
  if (!written.includes(EM_DASH)) process.exit(0);

  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse",
    additionalContext: `An em-dash was written into ${filePath}. TV 00 #5 bans them in code-adjacent text; replace it with a period, semicolon or colon.` } }));
});
