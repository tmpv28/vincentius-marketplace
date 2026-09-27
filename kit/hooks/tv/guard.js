// PreToolUse guard, no dependencies. Denies via JSON on stdout (exit 1 would NOT block).
// Threat model: an accident guard, not an adversary guard. It stops Claude from casually reading a
// secret or running a catastrophic command; anyone set on evading it can, since no regex survives a
// determined adversary. So it closes the cheap, plausible bypasses, keeps false positives down, and
// stops short of being a shell parser. The permission rules stay the real boundary.
// .env rule follows TV 00 #7: a committed .env is a schema, so a git-tracked .env may be read;
// every other .env* file is a secret, except the copy that seeds .env.local from the schema.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { commandBaseName, extractHeredocs, lexCommand, splitCommands, stripCommandPrefix } = require("./shell-command.js");
const { parseGitInvocation } = require("./git-invocation.js");

// ─── Secret files ───────────────────────────────────────────

const SECRET_PATH = /(^|\/)\.ssh(\/|$)|\.credentials\.json|(^|\/)id_(rsa|ed25519|ecdsa)\b|\.aws\/credentials|(^|\/)\.(npmrc|git-credentials|netrc|pypirc)$/;
const ENV_FILE = /^\.env(?:\.([^.]+)(?:\..*)?)?$/;
const SCHEMA_SUFFIXES = new Set(["example", "sample", "template", "dist", "defaults"]);
const GLOB = /[*?[{]/;

// Seeding .env.local from the schema copies bytes without reading them into context.
const SEED = /^\s*(cp|copy|copy-item)(\s+-\w+)*\s+["']?(\.\/)?\.env["']?\s+["']?(\.\/)?\.env\.local["']?\s*$/i;

const isEnvTracked = (dir) =>
  spawnSync("git", ["-C", dir, "ls-files", "--error-unmatch", "--", ".env"], { encoding: "utf8", timeout: 5000 }).status === 0;

// Git Bash spells C:\x as /c/x, which path.resolve on Windows would read as C:\c\x.
const toNativePath = (value) => (process.platform === "win32" ? value.replace(/^\/([a-z])(?=\/|$)/i, "$1:") : value);

// One word can name several files (a,b  -Path:x  {a,b}  x::$DATA), and NTFS ignores case and a
// trailing dot, so each spelling is reduced to the file Windows would actually open.
const pathFragments = (value) =>
  value
    .replace(/\\/g, "/")
    .split(/[,{}=<>()]/)
    .flatMap((part) => part.split(/(?<!^[A-Za-z]):/))
    .map((part) => part.replace(/["']/g, "").replace(/[.\s]+$/, ""))
    .filter((part) => part !== "");

const hasEnvGlob = (value) =>
  value.replace(/\\/g, "/").toLowerCase().split("/").some((part) => part.startsWith(".en") && GLOB.test(part));

// What makes `value` a secret reference, or null. isEnvRuleSkipped is for commands that never read
// content (echo, ls, git add): they may name a .env, but the other secrets stay off limits.
const findSecretIn = (value, baseDir, isEnvRuleSkipped = false) => {
  if (!isEnvRuleSkipped && hasEnvGlob(value)) return `${value} (a glob that can match .env files)`;
  for (const fragment of pathFragments(value)) {
    const lowerFragment = fragment.toLowerCase();
    if (SECRET_PATH.test(lowerFragment)) return fragment;
    if (isEnvRuleSkipped) continue;
    const baseName = lowerFragment.slice(lowerFragment.lastIndexOf("/") + 1);
    const envMatch = ENV_FILE.exec(baseName);
    if (!envMatch || SCHEMA_SUFFIXES.has(envMatch[1])) continue;
    if (envMatch[1]) return baseName;
    const folder = fragment.slice(0, fragment.length - baseName.length) || ".";
    if (GLOB.test(folder)) return ".env (under a glob)";
    if (!isEnvTracked(path.resolve(baseDir, toNativePath(folder)))) return ".env (untracked)";
  }
  return null;
};

// ─── Catastrophic targets ───────────────────────────────────

// Home and the system drive, spelled every way a shell on this machine might spell them.
const HOME_TOKEN = /^(~|\$\{?home\}?|\$\{?userprofile\}?|\$env:(userprofile|home)|%userprofile%)(?=\/|$)/i;
const DRIVE_TOKEN = /^(\$env:(homedrive|systemdrive)|%(homedrive|systemdrive)%)(?=\/|$)/i;
const DOTS_ONLY = /^\.\.?(\/\.\.?)*$/;

// Lowercase, forward slashes, Git Bash's /c as c:, and . and .. resolved: one spelling per place.
const canonicalPath = (value) => {
  const forward = value.replace(/\\/g, "/").toLowerCase().replace(/^\/([a-z])(?=\/|$)/, "$1:");
  const drive = /^[a-z]:/.exec(forward)?.[0] ?? "";
  const rest = path.posix.normalize(forward.slice(drive.length) || "/");
  return `${drive}${rest.length > 1 && rest.endsWith("/") ? rest.slice(0, -1) : rest}`;
};

const HOME_PATH = canonicalPath(os.homedir());

// Catastrophic means a root, home itself, a parent of home, or a path made only of dots. Anything
// inside home (~/Documents, ~/proj/build) is an ordinary delete, however large.
const isCatastrophicTarget = (target, isDotPathCatastrophic = true) => {
  const unglobbed = target === "*" ? "." : target.replace(/\\/g, "/").replace(/\/\*$/, "/");
  const expanded = unglobbed.replace(HOME_TOKEN, HOME_PATH).replace(DRIVE_TOKEN, process.env.SystemDrive || "c:");
  const canonical = canonicalPath(expanded);
  if (DOTS_ONLY.test(canonical)) return isDotPathCatastrophic;
  if (canonical === "/" || /^[a-z]:\/?$/.test(canonical)) return true;
  return canonical === HOME_PATH || HOME_PATH.startsWith(`${canonical}/`);
};

// ─── Command rules ──────────────────────────────────────────

const DELETE_COMMANDS = new Set(["rm", "rmdir", "rd", "del", "erase", "remove-item", "ri"]);
// cmd.exe switches (rd /s /q, del /f) look like Git Bash drive paths once slashes are normalised.
const CMD_SWITCH = /^\/[sqfpa](:.*)?$/i;
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const HEREDOC_INTERPRETERS = new Set([...SHELLS, "pwsh", "powershell", "python", "python3", "node"]);
const XARGS_OPTIONS_WITH_VALUE = new Set(["-n", "-L", "-P", "-I", "-d", "-E", "-s", "-a"]);

const NON_READING_COMMANDS = new Set(["echo", "printf", "test", "[", "[[", "ls"]);
const NON_READING_GIT = new Set(["rm", "add", "check-ignore", "ls-files", "status"]);
const FILE_REDIRECTS = new Set([">", ">>", "<", "&>", "&>>", ">&"]);
const MESSAGE_OPTIONS = new Set(["-m", "--message", "--body", "--title"]);
const GREP_COMMANDS = new Set(["grep", "egrep", "fgrep", "rg"]);
const GREP_OPTIONS_WITH_VALUE = new Set(["-A", "-B", "-C", "-m", "-d", "-D", "-f", "-g", "-t", "-T", "-j", "-M", "--file", "--glob", "--type", "--max-count", "--context", "--after-context", "--before-context"]);

const FETCH = "(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)";
const SHELL_NAME = "((ba|z|da|k)?sh|pwsh|powershell)";
const INTERPRETER = "((ba|z|da|k)?sh|iex|invoke-expression|pwsh|powershell|python3?|node)";
const PIPE_TO_SHELL = [
  // curl x | sh, curl x | tee y | sudo bash: any later stage of the pipeline.
  new RegExp(`\\b${FETCH}\\b[^;\\n]*?\\|\\s*(sudo\\s+(-\\S+\\s+)*)?${INTERPRETER}\\b`, "i"),
  // iex (iwr x), iex ((New-Object Net.WebClient).DownloadString(x))
  new RegExp(`\\b(iex|invoke-expression)\\b[^;\\n|]*?\\b(${FETCH}|downloadstring)\\b`, "i"),
  // bash <(curl x)
  new RegExp(`(^|[\\s;&|(])(${SHELL_NAME}|source|\\.|python3?|node)\\s+(-\\S+\\s+)*<\\(\\s*${FETCH}\\b`, "i"),
  // sh -c "$(curl x)", eval "$(curl x)"
  new RegExp(`\\b(${SHELL_NAME}|eval|source)\\b[^;\\n|]*?(\\$\\(|\`)\\s*${FETCH}\\b`, "i")
];
const MAX_NESTING = 4;

const isRecursiveFlag = (word) =>
  /^--recursive$|^-rec|^\/s$/i.test(word) || (/^-[a-z]{1,4}$/i.test(word) && /r/i.test(word));

const deleteTargets = (name, args) =>
  args
    .map((word) => word.replace(/^-(literal)?path:/i, ""))
    .filter((word) => word !== "" && !word.startsWith("-") && !(name !== "rm" && CMD_SWITCH.test(word)));

const isCatastrophicDelete = (name, args) =>
  DELETE_COMMANDS.has(name) && args.some(isRecursiveFlag) && deleteTargets(name, args).some((target) => isCatastrophicTarget(target));

// find is nearly always filtered (find . -name "*.log" -delete), so its dot paths are not counted.
const isCatastrophicFind = (name, args) => {
  if (name !== "find") return false;
  const firstExpression = args.findIndex((word) => /^[-(!]/.test(word));
  const roots = firstExpression === -1 ? args : args.slice(0, firstExpression);
  const doesDelete =
    args.includes("-delete") ||
    args.some((word, index) => /^-(exec|execdir|ok|okdir)$/.test(word) && DELETE_COMMANDS.has(commandBaseName(args[index + 1] ?? "")));
  return doesDelete && roots.some((root) => root !== "" && isCatastrophicTarget(root, false));
};

// echo / | xargs rm -rf: the targets arrive through the pipe.
const isCatastrophicXargs = (name, args, pipedFrom) => {
  if (name !== "xargs") return false;
  let index = 0;
  while (index < args.length && args[index].startsWith("-")) index += XARGS_OPTIONS_WITH_VALUE.has(args[index]) ? 2 : 1;
  const inner = stripCommandPrefix(args.slice(index));
  const feeder = pipedFrom ? stripCommandPrefix(pipedFrom.words.map((word) => word.value)) : null;
  const fedTargets = feeder && (feeder.name === "echo" || feeder.name === "printf") ? feeder.args : [];
  return isCatastrophicDelete(inner.name, [...inner.args, ...fedTargets]);
};

const isForcePush = (words) => {
  const git = parseGitInvocation(words);
  if (!git || git.subcommand !== "push") return false;
  return words
    .slice(git.subcommandIndex + 1)
    .some((word) => word === "--force" || word === "--mirror" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(word) || /^\+./.test(word));
};

// The command text a wrapper runs: bash -c "...", pwsh -Command ..., cmd /c ...
const wrappedPayload = (name, args) => {
  if (SHELLS.has(name)) {
    const flagIndex = args.findIndex((word) => /^-[a-z]*c[a-z]*$/.test(word));
    return flagIndex === -1 || flagIndex + 1 >= args.length ? null : { text: args[flagIndex + 1], dialect: "posix" };
  }
  const flagIndex =
    name === "pwsh" || name === "powershell"
      ? args.findIndex((word) => /^[-/]c(o(m(m(a(n(d)?)?)?)?)?)?$/i.test(word))
      : name === "cmd"
        ? args.findIndex((word) => /^\/[ck]$/i.test(word))
        : -1;
  return flagIndex === -1 ? null : { text: args.slice(flagIndex + 1).join(" "), dialect: "windows" };
};

// Commit messages and PR text are prose about files, not reads of them. A value that runs a
// command substitution is not masked, because the substitution still runs.
const messageWords = (command) => {
  const values = command.words.map((word) => word.value);
  const isGit = parseGitInvocation(values) !== null;
  return command.words.filter((word, index) => {
    if (word.substitutions.length > 0) return false;
    const previous = values[index - 1] ?? "";
    return (
      MESSAGE_OPTIONS.has(previous) ||
      /^--(message|body|title)=/.test(word.value) ||
      (isGit && (/^-[a-zA-Z]+m$/.test(previous) || /^-m./.test(word.value)))
    );
  });
};

// grep's first operand is a pattern, not a file, unless -e supplied the pattern instead.
const grepPatternIndexes = (args) => {
  const explicit = args.flatMap((word, index) => {
    if (word === "-e" || word === "--regexp") return [index + 1];
    return /^(-e.|--regexp=)/.test(word) ? [index] : [];
  });
  if (explicit.length > 0) return explicit;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--") return [index + 1];
    if (!args[index].startsWith("-")) return [index];
    if (GREP_OPTIONS_WITH_VALUE.has(args[index])) index++;
  }
  return [];
};

const findSecretInCommand = (command, masked, cwd) => {
  const values = command.words.map((word) => word.value);
  const { name, args, commandIndex } = stripCommandPrefix(values);
  const git = parseGitInvocation(values);
  const isNonReading = NON_READING_COMMANDS.has(name) || (git !== null && NON_READING_GIT.has(git.subcommand));
  const patternIndexes = GREP_COMMANDS.has(name) ? grepPatternIndexes(args).map((index) => commandIndex + 1 + index) : [];
  for (const [index, word] of command.words.entries()) {
    if (masked.has(word) || patternIndexes.includes(index)) continue;
    const secret = findSecretIn(word.value, cwd, isNonReading);
    if (secret) return secret;
  }
  // Redirections always touch the file, whatever the command: echo x > .env.local overwrites a secret.
  for (const redirect of command.redirects.filter((candidate) => FILE_REDIRECTS.has(candidate.operator))) {
    const secret = findSecretIn(redirect.target.value, cwd);
    if (secret) return secret;
  }
  return null;
};

const maskWords = (text, words) =>
  [...words]
    .sort((first, second) => second.start - first.start)
    .reduce((maskedText, word) => `${maskedText.slice(0, word.start)}MSG${maskedText.slice(word.end)}`, text);

// Heredoc bodies are masked unless a shell or interpreter receives them, because then they run.
const findViolation = (commandText, dialect, cwd, depth = 0) => {
  if (depth > MAX_NESTING || commandText.trim() === "") return null;
  const { text, heredocs } = extractHeredocs(commandText);
  const commands = splitCommands(lexCommand(text, dialect));
  const masked = new Set(commands.flatMap(messageWords));
  if (PIPE_TO_SHELL.some((pattern) => pattern.test(maskWords(text, masked)))) return "pipe-to-shell";
  const isSeed = SEED.test(commandText.replace(/\\/g, "/"));

  for (const command of commands) {
    const values = command.words.map((word) => word.value);
    const { name, args } = stripCommandPrefix(values);
    const nested = [...command.words, ...command.redirects.map((redirect) => redirect.target)]
      .flatMap((word) => word.substitutions.map((inner) => ({ text: inner, dialect })))
      .concat(wrappedPayload(name, args) ?? []);
    for (const payload of nested) {
      const violation = findViolation(payload.text, payload.dialect, cwd, depth + 1);
      if (violation) return violation;
    }
    if (isCatastrophicDelete(name, args) || isCatastrophicFind(name, args) || isCatastrophicXargs(name, args, command.pipedFrom))
      return "recursive delete on root/home";
    if (isForcePush(values)) return "force push";
    const secret = isSeed ? null : findSecretInCommand(command, masked, cwd);
    if (secret) return `secret file ${secret}`;
  }

  for (const heredoc of heredocs.filter((candidate) => HEREDOC_INTERPRETERS.has(candidate.receiver))) {
    const violation = findViolation(heredoc.body, dialect, cwd, depth + 1);
    if (violation) return violation;
  }
  return null;
};

// ─── Main ───────────────────────────────────────────────────

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); } // fail open; permission rules still apply
  if (!input || typeof input !== "object") process.exit(0);
  const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  const cwd = typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : process.cwd();
  const deny = (reason) => process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `guard: ${reason}` } }));

  if (typeof toolInput.command === "string") {
    const violation = findViolation(toolInput.command, input.tool_name === "PowerShell" ? "windows" : "posix", cwd);
    if (violation) return deny(violation);
  }

  // Creating a file that does not exist yet cannot expose an existing secret (new schema .env).
  const isCreating = (filePath) => input.tool_name === "Write" && !fs.existsSync(path.resolve(cwd, filePath));
  const paths = [toolInput.file_path, toolInput.path, toolInput.notebook_path].filter((value) => typeof value === "string" && value !== "");
  for (const filePath of paths) {
    if (isCreating(filePath)) continue;
    const secret = findSecretIn(filePath, cwd);
    if (secret) return deny(`secret file ${secret}`);
  }

  // Grep's glob picks files by name, so .env* there reads .env files as surely as a path would.
  if (typeof toolInput.glob === "string") {
    const secret = findSecretIn(toolInput.glob, path.resolve(cwd, typeof toolInput.path === "string" ? toolInput.path : "."));
    if (secret) return deny(`secret file ${secret}`);
  }
});
