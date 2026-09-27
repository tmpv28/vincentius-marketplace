// PostToolUse on Edit|Write: 00 #5 bans em-dashes in code-adjacent text.
// A notice, not a block: long-form docs may use them, and the template's std:check is the gate.
const CODE_FILE = /\.(tsx?|jsx?|mjs|cjs|s?css|html?|cpp|cc|cxx|hpp|hh|h|c|py|cs|go|rs|java|swift|kt|rb|php|sh|ps1)$/i;

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let toolInput = {};
  try { toolInput = JSON.parse(raw).tool_input || {}; } catch { process.exit(0); }
  const filePath = toolInput.file_path || "";
  if (!CODE_FILE.test(filePath)) process.exit(0);

  const written = [toolInput.content, toolInput.new_string].filter(Boolean).join("\n");
  if (!written.includes("\u2014")) process.exit(0);

  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse",
    additionalContext: `An em-dash was written into ${filePath}. 00 #5 bans them in code-adjacent text; replace it with a period, semicolon or colon.` } }));
});
