// PreToolUse on Bash: enforces 11-git-and-delivery on commit messages written by Claude.
// Reads both `git commit -m "..."` and the heredoc form Claude Code uses by default.
const TYPES = "feat|fix|docs|style|refactor|test|build|ci|perf|chore|revert";
const SUBJECT = new RegExp(`^((${TYPES})(\\([a-z0-9-]+\\))?!?: |\\[[a-z0-9-]+\\] )\\S`);
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n\s*\1\b/;
const INLINE = /\s-m\s+(["'])((?:(?!\1)[\s\S])*)\1/;

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let command = "";
  try { command = JSON.parse(raw).tool_input.command || ""; } catch { process.exit(0); }
  if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

  // Amends without a new message and merges keep the message git already has.
  const heredoc = HEREDOC.exec(command);
  const inline = INLINE.exec(command);
  const message = heredoc ? heredoc[2] : inline && !/^\$\(/.test(inline[2]) ? inline[2] : null;
  if (message === null) process.exit(0);

  const subject = message.split("\n")[0].trim();
  const problems = [
    !SUBJECT.test(subject) && "type(scope): or [campaign-tag] prefix",
    subject.length > 100 && "subject over 100 characters",
    /\.$/.test(subject) && "subject ends with a period",
    message.includes("\u2014") && "em-dash in the message"
  ].filter(Boolean);
  if (problems.length === 0) process.exit(0);

  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse",
    permissionDecision: "deny", permissionDecisionReason: `11-git-and-delivery: ${problems.join("; ")}` } }));
});
