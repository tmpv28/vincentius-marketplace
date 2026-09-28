// PreToolUse on Bash|PowerShell: enforces TV 11 on commit messages written by Claude.
// Reads every -m, a -F file, and the heredoc form Claude Code uses by default.
const fs = require("node:fs");
const path = require("node:path");

const { HEREDOC_MARKER, extractHeredocs, lexCommand, splitCommands } = require("./shell-command.js");
const { parseGitInvocation } = require("./git-invocation.js");
const { EM_DASH } = require("./code-extensions.js");
const { readInput, cwdOf } = require("./hook-input.js");

const TYPES = "feat|fix|docs|style|refactor|test|build|ci|perf|chore|revert";
// TV 11 sets no character set for a scope, so ui/button, @acme/ui, api,web and NotesList all pass.
const SUBJECT = new RegExp(`^((${TYPES})(\\([^()\\s]+\\))?!?: |\\[[a-z0-9-]+\\] )\\S`);
// -m "$(cat <<'EOF' ... EOF)", once extractHeredocs has swapped the body for its marker.
const CAT_HEREDOC = /^\$\(\s*cat\s+<<\s*__HEREDOC_(\d+)__\s*\)$/;
// Short options of git commit that take a value, so -am, -mfoo and -m foo parse the way git parses them.
const SHORT_OPTIONS_WITH_VALUE = "mFCct";
// Short options whose value, if any, is attached (-S<keyid>, -u<mode>), so the rest of the cluster is theirs.
const SHORT_OPTIONS_WITH_ATTACHED_VALUE = "Su";

// git accepts any unambiguous prefix of a long option, so --mess is --message. Listed are the options
// that share a prefix with --message or --file; --fi matches both file and fixup, and git rejects it.
const LONG_OPTIONS_NEAR_MESSAGE_OR_FILE = ["message", "file", "fixup"];
const longOptionNamed = (prefix) => {
  if (LONG_OPTIONS_NEAR_MESSAGE_OR_FILE.includes(prefix)) return prefix;
  const candidates = LONG_OPTIONS_NEAR_MESSAGE_OR_FILE.filter((option) => option.startsWith(prefix));
  return candidates.length === 1 ? candidates[0] : null;
};

// Every message source in git commit's arguments: { kind: "message" | "file", value, word }.
const messageSourcesOf = (argWords) => {
  const sources = [];
  for (let index = 0; index < argWords.length; index++) {
    const value = argWords[index].value;
    const next = argWords[index + 1];
    if (value === "--") break;
    const longMatch = /^--([a-z-]+)(?:=([\s\S]*))?$/.exec(value);
    const longName = longMatch ? longOptionNamed(longMatch[1]) : null;
    if (longName === "message" || longName === "file") {
      if (longMatch[2] !== undefined) sources.push({ kind: longName, value: longMatch[2], word: argWords[index] });
      else if (next) sources.push({ kind: longName, value: argWords[++index].value, word: next });
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

readInput().then((input) => {
  const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";
  if (!/\bcommit\b/.test(command)) process.exit(0);
  const cwd = cwdOf(input);
  // PowerShell has no heredocs; its here-strings (@'...'@) are unwrapped by the lexer instead.
  const isPowerShell = input.tool_name === "PowerShell";

  const { text, heredocs } = isPowerShell ? { text: command, heredocs: [] } : extractHeredocs(command);
  for (const gitCommand of splitCommands(lexCommand(text, isPowerShell ? "windows" : "posix"))) {
    const git = parseGitInvocation(gitCommand.words.map((word) => word.value));
    if (!git || git.subcommand !== "commit") continue;

    // Amends without a new message and merges keep the message git already has.
    const gitDir = git.workDirs.reduce((dir, workDir) => path.resolve(dir, workDir), cwd);
    const parts = messageSourcesOf(gitCommand.words.slice(git.subcommandIndex + 1)).map((source) => resolveSource(source, gitCommand, heredocs, gitDir));
    if (parts.length === 0 || parts.includes(null)) continue;

    const problems = problemsIn(parts.join("\n\n"));
    if (problems.length === 0) continue;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse",
      permissionDecision: "deny", permissionDecisionReason: `TV 11: ${problems.join("; ")}` } }));
    return;
  }
});
