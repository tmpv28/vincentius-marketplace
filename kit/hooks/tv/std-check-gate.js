// Stop hook: the Claude-side twin of .husky/pre-commit, so "done" cannot skip std:check (00 #6).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  // Only a turn in which Claude edited something is gated; the marker is consumed either way.
  const stateDir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "state", "tv-edited");
  const marker = input.session_id ? path.join(stateDir, input.session_id) : null;
  if (!marker || !fs.existsSync(marker)) process.exit(0);
  fs.rmSync(marker, { force: true });

  const cwd = input.cwd || process.cwd();
  let hasGate = false;
  try { hasGate = Boolean(JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")).scripts?.["std:check"]); } catch { hasGate = false; }
  if (!hasGate) process.exit(0);

  // shell is needed for pnpm.cmd on Windows; cwd is an option, never interpolated into the command.
  const check = spawnSync("pnpm", ["std:check"], { cwd, encoding: "utf8", shell: true });
  if (check.status === 0) process.exit(0);

  // Still failing after the one forced continuation: stop blocking (no loop), but say so to the user.
  if (input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: "std:check is still failing after one forced fix attempt. Not done." }));
    process.exit(0);
  }

  process.stderr.write(`std:check failed. Fix it before reporting done (00 #6).\n${(check.stdout + check.stderr).slice(-4000)}`);
  process.exit(2);
});
