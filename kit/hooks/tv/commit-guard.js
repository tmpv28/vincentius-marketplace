// PreToolUse on Bash: enforces 11-git-and-delivery on commit messages written by Claude.
// Reads every -m, a -F file, and the heredoc form Claude Code uses by default.
const fs = require("node:fs");
const path = require("node:path");

const { HEREDOC_MARKER, extractHeredocs, lexCommand, splitCommands } = require("./shell-command.js");
const { parseGitInvocation } = require("./git-invocation.js");

const TYPES = "feat|fix|docs|style|refactor|test|build|ci|perf|chore|revert";
const SUBJECT = new RegExp(`^((${TYPES})(\\([a-z0-9-]+\\))?!?: |\\[[a-z0-9-]+\\] )\\S`);
// By code point, because an editor can turn an escape back into the character this file bans.
const EM_DASH = String.fromCharCode(0x2014);
// -m "$(cat <<'EOF' ... EOF)", once extractHeredocs has swapped the body for its marker.
const CAT_HEREDOC = /^\$\(\s*cat\s+<<\s*__HEREDOC_(\d+)__\s*\)$/;
// Short options of git commit that take a value, so -am, -mfoo and -m foo parse the way git parses them.
const SHORT_OPTIONS_WITH_VALUE = "mFCct";
// Short options whose value, if any, is attached (-S<keyid>, -u<mode>), so the rest of the cluster is theirs.
const SHORT_OPTIONS_WITH_ATTACHED_VALUE = "Su";

// Every message source in git commit's arguments: { kind: "message" | "file", value, word }.
const messageSourcesOf = (argWords) => {
  const sources = [];
  for (let index = 0; index < argWords.length; index++) {
    const value = argWords[index].value;
    const next = argWords[index + 1];
    if (value === "--") break;
    const longOption = /^--(message|file)(?:=([\s\S]*))?$/.exec(value);
    if (longOption) {
      const kind = longOption[1] === "message" ? "message" : "file";
      if (longOption[2] !== undefined) sources.push({ kind, value: longOption[2], word: argWords[index] });
      else if (next) sources.push({ kind, value: argWords[++index].value, word: next });
      continue;
    }
    if (!/^-[a-zA-Z]/.test(value)) continue;
    for (let letter = 1; letter < value.length; letter++) {
      const option = value[letter];
      if (SHORT_OPTIONS_WITH_ATTACHED_VALUE.includes(option)) break;
      if (!SHORT_OPTIONS_WITH_VALUE.includes(option)) continue;
      const attached = value.slice(letter + 1);
      const source = attached !== "" ? { value: attached, word: argWords[index] } : next ? { value: argWords[++index].value, word: next } : null;
      if (source && option === "m") sources.push({ kind: "message", ...source });
      if (source && option === "F") sources.push({ kind: "file", ...source });
      break;
    }
  }
  return sources;
};

// The text a source contributes, or null when it cannot be known before git runs ($MSG, a missing file).
const resolveSource = (source, command, heredocs, cwd) => {
  if (source.kind === "message") {
    const heredocMatch = CAT_HEREDOC.exec(source.value);
    if (heredocMatch) return heredocs[Number(heredocMatch[1])]?.body ?? null;
    return source.word.hasExpansion ? null : source.value;
  }
  if (source.value === "-") {
    // Only a heredoc on this same git command is its stdin; an earlier one belongs to another command.
    const stdin = command.redirects.find((redirect) => redirect.operator === "<<" && HEREDOC_MARKER.test(redirect.target.value));
    return stdin ? heredocs[Number(HEREDOC_MARKER.exec(stdin.target.value)[1])]?.body ?? null : null;
  }
  if (source.word.hasExpansion) return null;
  try { return fs.readFileSync(path.resolve(cwd, source.value), "utf8"); } catch { return null; } // git reports an unreadable file itself
};

const problemsIn = (message) => {
  // git drops leading blank lines, and its subject is the whole first paragraph, not the first line.
  const cleaned = message.replace(/^(?:[ \t]*\r?\n)+/, "");
  const subject = cleaned.split(/\r?\n[ \t]*\r?\n/)[0].split(/\r?\n/).map((line) => line.trim()).join(" ");
  return [
    !SUBJECT.test(subject) && "type(scope): or [campaign-tag] prefix",
    subject.length > 100 && "subject over 100 characters",
    /\.$/.test(subject) && "subject ends with a period",
    cleaned.includes(EM_DASH) && "em-dash in the message"
  ].filter(Boolean);
};

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";
  if (!/\bcommit\b/.test(command)) process.exit(0);
  const cwd = typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : process.cwd();

  const { text, heredocs } = extractHeredocs(command);
  for (const gitCommand of splitCommands(lexCommand(text))) {
    const git = parseGitInvocation(gitCommand.words.map((word) => word.value));
    if (!git || git.subcommand !== "commit") continue;

    // Amends without a new message and merges keep the message git already has.
    const parts = messageSourcesOf(gitCommand.words.slice(git.subcommandIndex + 1)).map((source) => resolveSource(source, gitCommand, heredocs, cwd));
    if (parts.length === 0 || parts.includes(null)) continue;

    const problems = problemsIn(parts.join("\n\n"));
    if (problems.length === 0) continue;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse",
      permissionDecision: "deny", permissionDecisionReason: `11-git-and-delivery: ${problems.join("; ")}` } }));
    return;
  }
});
