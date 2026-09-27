// PostToolUse on Edit|Write|NotebookEdit: marks that Claude changed a file this turn, so the
// std:check gate runs only after Claude's own edits, never for a question on a dirty tree.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  if (!input.session_id) process.exit(0);
  const stateDir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "state", "tv-edited");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, input.session_id), input.cwd || process.cwd());
});
