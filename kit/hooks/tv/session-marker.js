// The per-session marker edit-marker.js writes and std-check-gate.js consumes: which projects Claude
// edited since std:check last passed. Stored as { "projectDirs": [...] }.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// A session id becomes a file name, so it must not be able to name a file anywhere else (../../x).
const markerPathFor = (sessionId) => {
  const fileName = typeof sessionId === "string" ? path.basename(sessionId) : "";
  if (fileName === "" || /^\.+$/.test(fileName)) return null;
  // Its own copy of scripts/files.mjs's configDir(): the hooks are installed without scripts/.
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "state", "tv-edited", fileName);
};

// The marker was once a bare cwd string; that, and anything unreadable, counts as no projects recorded.
const readMarkedProjects = (markerPath) => {
  try {
    const projectDirs = JSON.parse(fs.readFileSync(markerPath, "utf8"))?.projectDirs;
    return Array.isArray(projectDirs) ? projectDirs.filter((dir) => typeof dir === "string" && dir !== "") : [];
  } catch {
    return [];
  }
};

const markProject = (markerPath, projectDir) => {
  const projectDirs = readMarkedProjects(markerPath);
  if (fs.existsSync(markerPath) && (projectDir === null || projectDirs.includes(projectDir))) return;
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, JSON.stringify({ projectDirs: projectDir === null ? projectDirs : [...projectDirs, projectDir] }));
};

module.exports = { markerPathFor, readMarkedProjects, markProject };
