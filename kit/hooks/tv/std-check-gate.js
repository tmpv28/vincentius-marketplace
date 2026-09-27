// Stop hook: the Claude-side twin of .husky/pre-commit, so "done" cannot skip std:check (00 #6).
// It runs a repo's std:check without asking, which leans on Claude Code's workspace trust, so it runs
// ONLY a std:check that is the repo's own node script (node scripts/<file>.js), never any other command.
// It runs that script with this node directly, not through pnpm and not through a shell: pnpm would
// also run pre/post scripts, an install step and a repo .npmrc's script-shell, none of which were vetted.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { markerPathFor, readMarkedProjects } = require("./session-marker.js");

// The TV template's `node scripts/standardCheck.js` and this repo's `node scripts/std-check.mjs`.
// Arguments may follow, but no shell syntax or quotes, so splitting them on whitespace is exact.
const LOCAL_NODE_SCRIPT = /^node\s+((?:\.\/)?scripts\/[\w.-]+\.(?:c|m)?js)((?:\s[^;&|<>`$()'"\n]*)?)$/;
// Under the 600s Stop timeout in hooks.snippet.json, so a slow check is reported here rather than
// killed there. TV_STD_CHECK_BUDGET_MS exists so the tests can reach the timeout path.
const CHECK_BUDGET_MS = Number(process.env.TV_STD_CHECK_BUDGET_MS) || 570000;

// { script } when the project has a gate, {} when it has none, { isUnparseable } when package.json is broken.
const readGate = (projectDir) => {
  const packagePath = path.join(projectDir, "package.json");
  if (!fs.existsSync(packagePath)) return {};
  try {
    const script = JSON.parse(fs.readFileSync(packagePath, "utf8"))?.scripts?.["std:check"];
    return typeof script === "string" ? { script } : {};
  } catch {
    return { isUnparseable: true };
  }
};

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  // Only a turn in which Claude edited something is gated.
  const markerPath = markerPathFor(input?.session_id);
  if (!markerPath || !fs.existsSync(markerPath)) process.exit(0);
  const recordedDirs = readMarkedProjects(markerPath);
  const projectDirs = recordedDirs.length > 0 ? recordedDirs : [typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : process.cwd()];

  const deadline = Date.now() + CHECK_BUDGET_MS;
  const notices = [];
  const failures = [];
  for (const projectDir of projectDirs) {
    const gate = readGate(projectDir);
    if (gate.isUnparseable) notices.push(`${path.join(projectDir, "package.json")} could not be parsed, so std:check did not run there.`);
    const localScript = gate.script ? LOCAL_NODE_SCRIPT.exec(gate.script.trim()) : null;
    if (!localScript) continue;

    const [, scriptPath, scriptArgs] = localScript;
    const args = scriptArgs.split(/\s+/).filter((arg) => arg !== "");
    const check = spawnSync(process.execPath, [scriptPath, ...args], { cwd: projectDir, encoding: "utf8", timeout: Math.max(deadline - Date.now(), 1) });
    if (check.error?.code === "ETIMEDOUT") failures.push(`std:check timed out after ${Math.round(CHECK_BUDGET_MS / 1000)}s in ${projectDir}; that counts as failing.`);
    else if (check.status !== 0) failures.push(`std:check failed in ${projectDir}.\n${`${check.stdout ?? ""}${check.stderr ?? ""}`.slice(-4000)}`);
  }

  // The marker survives a block, so the forced retry is checked again rather than waved through.
  if (failures.length === 0 || input.stop_hook_active) fs.rmSync(markerPath, { force: true });

  if (failures.length === 0) {
    if (notices.length > 0) process.stdout.write(JSON.stringify({ systemMessage: notices.join(" ") }));
    process.exit(0);
  }

  // Still failing after the one forced continuation: stop blocking (no loop), but say so to the user.
  if (input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: ["std:check is still failing after one forced fix attempt. Not done.", ...notices].join(" ") }));
    process.exit(0);
  }

  process.stderr.write(`std:check failed. Fix it before reporting done (00 #6).\n${[...notices, ...failures].join("\n")}`);
  process.exit(2);
});
