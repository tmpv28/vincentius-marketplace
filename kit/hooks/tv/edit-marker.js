// PostToolUse on Edit|MultiEdit|Write|NotebookEdit: marks that Claude changed a file this turn, so the
// std:check gate runs only after Claude's own edits, never for a question on a dirty tree.
// It records the edited file's project, so an edit outside the session's cwd is gated where it lives.
const fs = require("node:fs");
const path = require("node:path");

const { markerPathFor, markProject } = require("./session-marker.js");

const findProjectRoot = (filePath) => {
  for (let dir = path.dirname(filePath); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
};

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const markerPath = markerPathFor(input?.session_id);
  if (!markerPath) process.exit(0);

  const cwd = typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : process.cwd();
  // Edit, MultiEdit and Write name the file in file_path; NotebookEdit names it in notebook_path.
  const editedFile = input.tool_input?.file_path || input.tool_input?.notebook_path;
  markProject(markerPath, typeof editedFile === "string" ? findProjectRoot(path.resolve(cwd, editedFile)) : null);
});
