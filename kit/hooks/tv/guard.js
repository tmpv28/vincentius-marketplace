// PreToolUse guard, no dependencies. Denies via JSON on stdout (exit 1 would NOT block).
// Threat model: an accident guard, not an adversary guard. It stops Claude from casually reading a
// secret or running a catastrophic command; anyone set on evading it can, since no regex survives a
// determined adversary. So it closes the cheap, plausible bypasses, keeps false positives down, and
// stops short of being a shell parser. The permission rules stay the real boundary.
// Accepted leaks, by decision: grep -rn KEY . (a recursive search that may pass through .env.local)
// and docker compose config (which prints the environment it loaded); both are ordinary daily work.
// .env rule follows TV 00 #7: a committed .env is a schema, so a git-tracked .env may be read;
// every other .env* file is a secret, except the copy that seeds .env.local from the schema (.env,
// .env.example, .env.sample, .env.template, .env.dist or .env.defaults).
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { commandBaseName, extractHeredocs, lexCommand, splitCommands, stripCommandPrefix } = require("./shell-command.js");
const { parseGitInvocation } = require("./git-invocation.js");
const { readInput, cwdOf } = require("./hook-input.js");
const { CODE_ADJACENT_FILE } = require("./code-extensions.js");

// ─── Secret files ───────────────────────────────────────────

const SECRET_PATH = /(^|\/)\.ssh(\/|$)|\.credentials\.json|(^|\/)id_(rsa|ed25519|ecdsa)\b|\.aws\/credentials|(^|\/)\.(git-credentials|netrc|pypirc)$/;
// A project .npmrc is pnpm config and is usually committed, but it can carry an _authToken. So it
// follows the bare .env's rule: tracked may be read, untracked may not, and ~/.npmrc never may.
const NPMRC = ".npmrc";
const UNTRACKED_NPMRC = ".npmrc (untracked)";
// A public key is meant to be shared: cat ~/.ssh/id_ed25519.pub is how it gets pasted somewhere.
const PUBLIC_KEY = /\.pub$/;
const ENV_FILE = /^\.env(?:\.([^.]+)(?:\..*)?)?$/;
// src/lib/.env.ts and .env.d.ts are source code about the environment, not environment files. Data
// formats in the code list stay secrets: a .env.json or .env.yml can hold the same values.
const isEnvSourceCode = (baseName) => CODE_ADJACENT_FILE.test(baseName) && !/\.(json|ya?ml|sh|ps1)$/i.test(baseName);
const SCHEMA_SUFFIXES = new Set(["example", "sample", "template", "dist", "defaults"]);
const GLOB = /[*?[{]/;

// Seeding .env.local from the schema (.env, or .env.example and its kin) copies bytes without reading
// them into context. Matched per simple command, so [ -f .env.local ] || cp ... is a seed, and a read
// chained after it (&& cat .env.local) is still checked on its own. Source and destination must share
// a folder (apps/api/.env.example to apps/api/.env.local), so a seed never lands in another project.
const SEED_COMMANDS = new Set(["cp", "copy", "copy-item", "cpi"]);
const CHANGE_DIRECTORY_COMMANDS = new Set(["cd", "pushd", "set-location", "sl", "chdir"]);
const SEED_SOURCE_NAME = new RegExp(`^\\.env(\\.(${[...SCHEMA_SUFFIXES].join("|")}))?$`, "i");

// Resolved against the folder the command runs in, so ./x, x and an absolute path to x agree.
const folderAndName = (value, cwd) => {
  const resolved = path.resolve(cwd, toNativePath(value)).replace(/\\/g, "/").toLowerCase();
  const slash = resolved.lastIndexOf("/");
  return [resolved.slice(0, slash) || "/", resolved.slice(slash + 1)];
};

// .env.local from any schema; the bare .env (itself a schema, TV 00 #7) only from a suffixed schema.
const isSeedPair = (source, destination, cwd) => {
  if (typeof source !== "string" || typeof destination !== "string") return false;
  const [sourceFolder, sourceName] = folderAndName(source, cwd);
  const [destinationFolder, destinationName] = folderAndName(destination, cwd);
  if (sourceFolder !== destinationFolder || !SEED_SOURCE_NAME.test(sourceName)) return false;
  return destinationName === ".env.local" || (destinationName === ".env" && sourceName !== ".env");
};

const isTrackedIn = (dir, fileName) =>
  spawnSync("git", ["-C", dir, "ls-files", "--error-unmatch", "--", fileName], { encoding: "utf8", timeout: 5000 }).status === 0;

// Git Bash spells C:\x as /c/x, which path.resolve on Windows would read as C:\c\x.
const toNativePath = (value) => (process.platform === "win32" ? value.replace(/^\/([a-z])(?=\/|$)/i, "$1:") : value);

// One word can name several files (a,b  -Path:x  {a,b}  x::$DATA), and NTFS ignores case and a
// trailing dot, so each spelling is reduced to the file Windows would actually open. Whitespace
// separates names only outside quotes: a quoted string with spaces is prose, not a list of paths.
const pathFragments = (value, isWhitespaceSplit) =>
  value
    .replace(/\\/g, "/")
    .split(isWhitespaceSplit ? /[,{}=<>()\s]/ : /[,{}=<>()]/)
    .flatMap((part) => part.split(/(?<!^[A-Za-z]):/))
    .map((part) => part.replace(/["']/g, "").replace(/[.\s]+$/, ""))
    .filter((part) => part !== "");

// Split on = : , too, so --include=.env* and -Filter:.env* are seen as the glob they carry.
const hasEnvGlob = (value) =>
  value.replace(/\\/g, "/").toLowerCase().split(/[/=:,]/).some((part) => part.startsWith(".en") && GLOB.test(part));

// What makes `value` a secret reference, or null. isEnvRuleSkipped is for commands that never read
// content (echo, ls, git add): they may name a .env, but the other secrets stay off limits.
const findSecretIn = (value, baseDir, isEnvRuleSkipped = false, isWhitespaceSplit = true) => {
  if (!isEnvRuleSkipped && hasEnvGlob(value)) return `${value} (a glob that can match .env files)`;
  for (const fragment of pathFragments(value, isWhitespaceSplit)) {
    const lowerFragment = fragment.toLowerCase();
    if (SECRET_PATH.test(lowerFragment) && !PUBLIC_KEY.test(lowerFragment)) return fragment;
    if (isEnvRuleSkipped) continue;
    const baseName = lowerFragment.slice(lowerFragment.lastIndexOf("/") + 1);
    const folder = fragment.slice(0, fragment.length - baseName.length) || ".";
    const folderPath = () => path.resolve(baseDir, toNativePath(folder.replace(HOME_TOKEN, HOME_PATH)));
    if (baseName === NPMRC) {
      if (canonicalPath(folderPath()) === HOME_PATH) return "~/.npmrc";
      if (GLOB.test(folder) || !isTrackedIn(folderPath(), NPMRC)) return UNTRACKED_NPMRC;
      continue;
    }
    const envMatch = ENV_FILE.exec(baseName);
    if (!envMatch || SCHEMA_SUFFIXES.has(envMatch[1]) || isEnvSourceCode(baseName)) continue;
    if (envMatch[1]) return baseName;
    if (GLOB.test(folder)) return ".env (under a glob)";
    if (!isTrackedIn(folderPath(), ".env")) return ".env (untracked)";
  }
  return null;
};

// ─── Catastrophic targets ───────────────────────────────────

// Home and the system drive, spelled every way a shell on this machine might spell them.
// ${HOME:?} and ${HOME:-x} are still home; ${HOME:+x} is x, so it is not listed.
const HOME_TOKEN = /^(~|\$home|\$userprofile|\$\{(home|userprofile)(:?[-?=][^}]*)?\}|\$env:(userprofile|home)|%userprofile%)(?=\/|$)/i;
const DRIVE_TOKEN = /^(\$env:(homedrive|systemdrive)|\$\{?(homedrive|systemdrive)\}?|%(homedrive|systemdrive)%)(?=\/|$)/i;
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
  // A trailing * or dotfile glob (.*, .[!.]*, .??*) empties the folder it sits in, so the folder is the target.
  const forward = target.replace(/\\/g, "/");
  const unglobbed = forward === "*" || /^\.[*?[][^/]*$/.test(forward) ? "." : forward.replace(/\/(\*|\.[*?[][^/]*)$/, "/");
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
// A heredoc fed to a shell runs as commands; one fed to node or python runs as code, where only a
// string literal can name a file (a comment about .env.local reads nothing).
const HEREDOC_SHELLS = new Map([...[...SHELLS].map((shell) => [shell, "posix"]), ["pwsh", "windows"], ["powershell", "windows"]]);
const HEREDOC_CODE_INTERPRETERS = new Set(["python", "python3", "py", "node"]);
const CODE_COMMENT_LINE = /^[ \t]*(\/\/|#).*$/gm;
const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const XARGS_OPTIONS_WITH_VALUE = new Set(["-n", "-L", "-P", "-I", "-d", "-E", "-s", "-a"]);

const NON_READING_COMMANDS = new Set(["echo", "printf", "write-host", "write-output", "where-object"]);
// Commands that touch a file without reading it: an existence check, or a delete. Their arguments are
// not checked at all, so test -f ~/.ssh/id_ed25519 and rm -f .env.local pass; a recursive delete of
// a root or home is still caught by the delete rules, and a redirect is still checked.
const EXISTENCE_CHECKS = new Set(["test", "[", "[[", "test-path"]);
// touch and New-Item create a file or its timestamp; they read nothing.
const CREATE_COMMANDS = new Set(["touch", "new-item", "ni"]);
// Cmdlets that shape a listing's objects without opening the files behind them.
const LISTING_CONSUMERS = new Set(["select-object", "select", "where-object", "where", "?", "measure-object", "measure", "sort-object", "sort", "format-table", "ft", "format-list", "fl"]);
// Listing names reads no content, so even ~/.ssh may be listed; but a listing piped onward or wrapped
// in ( ) hands those files to something that may read them (gci .env* | Get-Content).
const LISTING_COMMANDS = new Set(["get-childitem", "gci", "ls", "dir", "get-item", "gi"]);
// A literal string piped into one of these is written to a file, not read from one.
const PIPE_WRITERS = new Set(["set-content", "add-content", "sc", "ac", "out-file"]);
// git restore writes a file from the index or a commit; it never shows its content.
const NON_READING_GIT = new Set(["rm", "add", "check-ignore", "ls-files", "status", "clean", "restore"]);
const CONTENT_WRITERS = new Set(["set-content", "add-content", "sc", "ac"]);
const CONTENT_OPTIONS_WITH_VALUE = /^-(encoding|stream|filter|include|exclude|credential|delimiter)$/i;
const FILE_REDIRECTS = new Set([">", ">>", "<", "&>", "&>>", ">&", "*>", "*>>"]);
const MESSAGE_OPTIONS = new Set(["-m", "--message", "--body", "--title", "--notes"]);
const GREP_COMMANDS = new Set(["grep", "egrep", "fgrep", "rg"]);
const GREP_OPTIONS_WITH_VALUE = new Set(["-A", "-B", "-C", "-m", "-d", "-D", "-f", "-g", "-t", "-T", "-j", "-M", "--file", "--glob", "--type", "--max-count", "--context", "--after-context", "--before-context"]);

const FETCH = "(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)";
const SHELL_NAME = "((ba|z|da|k)?sh|pwsh|powershell)";
const SHELL_READER = "((ba|z|da|k)?sh|iex|invoke-expression|pwsh|powershell)\\b";
// python and node run their stdin only with no script argument, or with "-": python3 -m json.tool reads data.
const STDIN_READER = "(python3?|node)(\\s+-[a-zA-Z-]+)*(\\s+-)?\\s*(?=$|[;&|)\\n])";
const PIPE_TO_SHELL = [
  // curl x | sh, curl x | tee y | sudo bash: any later stage of the pipeline. || is not a pipe.
  new RegExp(`\\b${FETCH}\\b[^;\\n]*?(?<!\\|)\\|(?!\\|)\\s*(sudo\\s+(-\\S+\\s+)*)?(${SHELL_READER}|${STDIN_READER})`, "i"),
  // iex (iwr x), iex ((New-Object Net.WebClient).DownloadString(x))
  new RegExp(`\\b(iex|invoke-expression)\\b[^;\\n|]*?\\b(${FETCH}|downloadstring)\\b`, "i"),
  // bash <(curl x)
  new RegExp(`(^|[\\s;&|(])(${SHELL_NAME}|source|\\.|python3?|node)\\s+(-\\S+\\s+)*<\\(\\s*${FETCH}\\b`, "i"),
  // sh -c "$(curl x)", eval "$(curl x)"
  new RegExp(`\\b(${SHELL_NAME}|eval|source)\\b[^;\\n|]*?(\\$\\(|\`)\\s*${FETCH}\\b`, "i")
];
const MAX_NESTING = 4;
const MAX_COMMAND_BYTES = 64 * 1024;

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

// Get-ChildItem C:\ | Remove-Item -Recurse: PowerShell's xargs, where the targets arrive through the pipe.
const isCatastrophicPipedRemove = (name, args, pipedFrom) => {
  if (!DELETE_COMMANDS.has(name) || !pipedFrom) return false;
  const source = stripCommandPrefix(pipedFrom.words.map((word) => word.value));
  if (!LISTING_COMMANDS.has(source.name)) return false;
  const isRecursive = args.some(isRecursiveFlag) || source.args.some(isRecursiveFlag);
  // A filtered listing (-Filter *.log, -Include bin,obj) removes matches, not the folder, so "." is safe.
  const isFiltered = source.args.some((word) => /^-(filter|include|exclude)(:|$)/i.test(word));
  // No path lists the current folder: Get-ChildItem | Remove-Item -Recurse is rm -rf *.
  const listedPaths = deleteTargets(source.name, source.args);
  return isRecursive && (listedPaths.length > 0 ? listedPaths : ["."]).some((target) => isCatastrophicTarget(target, !isFiltered));
};

const isForcePush = (words) => {
  const git = parseGitInvocation(words);
  if (!git || git.subcommand !== "push") return false;
  return words
    .slice(git.subcommandIndex + 1)
    .some((word) => word === "--force" || word === "--mirror" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(word) || /^\+./.test(word));
};

// The command text a wrapper runs: bash -c "...", eval "...", pwsh -Command ..., cmd /c ...
const wrappedPayload = (name, args) => {
  if (name === "eval") return args.length === 0 ? null : { text: args.join(" "), dialect: "posix" };
  if (SHELLS.has(name)) {
    const flagIndex = args.findIndex((word) => /^-[a-z]*c[a-z]*$/.test(word));
    return flagIndex === -1 || flagIndex + 1 >= args.length ? null : { text: args[flagIndex + 1], dialect: "posix" };
  }
  // cmd takes /c, or //c from Git Bash, where MSYS would otherwise rewrite /c as a path.
  const flagIndex =
    name === "pwsh" || name === "powershell"
      ? args.findIndex((word) => /^[-/]c(o(m(m(a(n(d)?)?)?)?)?)?$/i.test(word))
      : name === "cmd"
        ? args.findIndex((word) => /^\/\/?[ck]$/i.test(word))
        : -1;
  return flagIndex === -1 ? null : { text: args.slice(flagIndex + 1).join(" "), dialect: "windows" };
};

// Commit messages and PR text are prose about files, not reads of them. A value that runs a
// command substitution is not masked, because the substitution still runs.
const messageWords = (command) => {
  const values = command.words.map((word) => word.value);
  const isGit = parseGitInvocation(values) !== null;
  const isGh = stripCommandPrefix(values).name === "gh";
  return command.words.filter((word, index) => {
    if (word.substitutions.length > 0) return false;
    const previous = values[index - 1] ?? "";
    return (
      MESSAGE_OPTIONS.has(previous) ||
      /^--(message|body|title|notes)=/.test(word.value) ||
      (isGit && (/^-[a-zA-Z]+m$/.test(previous) || /^-m./.test(word.value))) ||
      (isGh && (previous === "-t" || previous === "-b"))
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

// Select-String's pattern, by -Pattern or as its first positional argument, is a regex, not a path.
const SELECT_STRING_OPTIONS_WITH_VALUE = /^-(path|literalpath|include|exclude|encoding|context|culture)$/i;
const selectStringPatternIndexes = (args) => {
  for (let index = 0; index < args.length; index++) {
    const word = args[index];
    if (/^-pat(t(e(r(n)?)?)?)?:/i.test(word)) return [index];
    if (/^-pat(t(e(r(n)?)?)?)?$/i.test(word)) return [index + 1];
    if (SELECT_STRING_OPTIONS_WITH_VALUE.test(word)) index++;
    else if (!word.startsWith("-")) return [index];
  }
  return [];
};

// grep --exclude=.env names a file to skip, the opposite of reading it.
const grepExcludeIndexes = (args) =>
  args.flatMap((word, index) => {
    if (/^--exclude(-dir)?=/.test(word)) return [index];
    return word === "--exclude" || word === "--exclude-dir" ? [index + 1] : [];
  });

// Set-Content's text, given by -Value or as the positional argument after the path, is written, not read.
const contentValueIndexes = (args) => {
  const valueIndexes = [];
  const positionalIndexes = [];
  let hasNamedPath = false;
  for (let index = 0; index < args.length; index++) {
    const word = args[index];
    if (/^-va(l(u(e)?)?)?:/i.test(word)) valueIndexes.push(index);
    else if (/^-va(l(u(e)?)?)?$/i.test(word)) valueIndexes.push(++index);
    else if (/^-(path|literalpath|lp|pspath)(:|$)/i.test(word)) {
      hasNamedPath = true;
      if (!word.includes(":")) index++;
    } else if (CONTENT_OPTIONS_WITH_VALUE.test(word)) index++;
    else if (!word.startsWith("-")) positionalIndexes.push(index);
  }
  return [...valueIndexes, ...positionalIndexes.slice(hasNamedPath ? 0 : 1)];
};

// Tools that load an env file into the process they start, with the options that name the file.
// Their options end at "--" (dotenv, dotenvx) or at the command they run (env-cmd).
const ENV_LOADERS = new Map([
  ["dotenv", { fileOptions: ["-e"], isStoppedByCommand: false }],
  ["dotenv-cli", { fileOptions: ["-e"], isStoppedByCommand: false }],
  ["dotenvx", { fileOptions: ["-f", "--env-file"], isStoppedByCommand: false }],
  ["env-cmd", { fileOptions: ["-f", "--file"], isStoppedByCommand: true }]
]);

// --env-file (node, tsx, docker compose), dotenv -e, dotenvx -f, env-cmd -f and DOTENV_CONFIG_PATH load a
// file into the process's environment, not into context, whatever the command that takes them.
const envLoaderIndexes = (values) => {
  const indexes = values.flatMap((value, index) =>
    /^--env-file(-if-exists)?=|^dotenv_config_path=/i.test(value) || /^--env-file(-if-exists)?$/.test(values[index - 1] ?? "") ? [index] : []);
  const loaderAt = values.findIndex((value) => ENV_LOADERS.has(commandBaseName(value)));
  if (loaderAt === -1) return indexes;
  const { fileOptions, isStoppedByCommand } = ENV_LOADERS.get(commandBaseName(values[loaderAt]));
  for (let index = loaderAt + 1; index < values.length && values[index] !== "--"; index++) {
    const value = values[index];
    if (fileOptions.includes(value)) indexes.push(++index);
    else if (fileOptions.some((option) => value.startsWith(`${option}=`))) indexes.push(index);
    else if (!value.startsWith("-") && isStoppedByCommand) break;
  }
  return indexes;
};

// vercel env pull .env.local writes the project's variables into the file and prints none of them.
const vercelEnvPullIndexes = (values) => {
  const vercelAt = values.findIndex((value, index) => commandBaseName(value) === "vercel" && values[index + 1] === "env" && values[index + 2] === "pull");
  return vercelAt === -1 ? [] : values.slice(vercelAt + 3).flatMap((value, offset) => (value.startsWith("-") ? [] : [vercelAt + 3 + offset]));
};

// git log -- .env.local lists the commits that touched it: history, not content, unless a patch is asked for.
const isGitHistoryOnly = (values, git) =>
  git?.subcommand === "log" && !values.slice(git.subcommandIndex + 1).some((value) => /^(-p|-u|--patch|-U\d*|--unified(=.*)?)$/.test(value));

// find with no action lists names; -name/-path values are patterns. With -exec or -delete it acts on them.
const FIND_ACTIONS = /^-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)$/;
const findPatternIndexes = (args) =>
  args.some((word) => FIND_ACTIONS.test(word))
    ? []
    : args.flatMap((word, index) => (/^-(i?name|i?path|i?wholename)$/.test(args[index - 1] ?? "") ? [index] : []));

// PowerShell's comparison operators take a pattern or value, not a path: $_.Name -like '.env*'.
const COMPARISON_OPERATOR = /^-[ci]?(like|notlike|match|notmatch|eq|ne)$/i;

// Words that name no file read into context: grep's pattern and --exclude, the pattern of git grep and
// Select-String, git log --grep, git log's pathspec, find's name patterns, a comparison's right-hand
// side, and an env file loaded into a process. Indexes are into the command's words.
const unreadWordIndexes = (values, name, args, commandIndex, git) => {
  const fromArgs = (indexes, offset) => indexes.map((index) => offset + index);
  const always = [
    ...envLoaderIndexes(values),
    ...vercelEnvPullIndexes(values),
    ...values.flatMap((value, index) => (COMPARISON_OPERATOR.test(values[index - 1] ?? "") ? [index] : []))
  ];
  // rg --files lists names, so its -g globs select names to print, not content to read.
  if (name === "rg" && args.includes("--files"))
    return [...always, ...fromArgs(args.flatMap((word, index) => (/^(-g|--glob)$/.test(args[index - 1] ?? "") || /^--glob=/.test(word) ? [index] : [])), commandIndex + 1)];
  if (GREP_COMMANDS.has(name)) return [...always, ...fromArgs([...grepPatternIndexes(args), ...grepExcludeIndexes(args)], commandIndex + 1)];
  if (name === "select-string" || name === "sls") return [...always, ...fromArgs(selectStringPatternIndexes(args), commandIndex + 1)];
  if (name === "find") return [...always, ...fromArgs(findPatternIndexes(args), commandIndex + 1)];
  if (git?.subcommand === "grep") return [...always, ...fromArgs(grepPatternIndexes(values.slice(git.subcommandIndex + 1)), git.subcommandIndex + 1)];
  if (git) {
    const pathspecStart = isGitHistoryOnly(values, git) ? values.indexOf("--", git.subcommandIndex) : -1;
    const pathspec = pathspecStart === -1 ? [] : values.slice(pathspecStart + 1).map((value, offset) => pathspecStart + 1 + offset);
    return [...always, ...pathspec, ...values.flatMap((value, index) => (/^--grep=/.test(value) || values[index - 1] === "--grep" ? [index] : []))];
  }
  return always;
};

// PowerShell common parameters that take a value: Copy-Item ... -ErrorAction Stop is still a seed.
const COMMON_PARAMETERS_WITH_VALUE = /^-(erroraction|warningaction|informationaction|progressaction|errorvariable|warningvariable|informationvariable|outvariable|outbuffer|pipelinevariable|ea|wa|ia|ev|wv|iv|ov|ob|pv)$/i;

// The source and destination a copy or write names: -Path/-LiteralPath/-Destination/-FilePath in any
// order, or positionally; switches (-Force, -n) and common parameters are skipped.
const pathOperands = (args) => {
  const named = {};
  const positional = [];
  for (let index = 0; index < args.length; index++) {
    const word = args[index];
    const option = /^-(path|literalpath|destination|filepath)(?::(.*))?$/i.exec(word);
    if (option) named[option[1].toLowerCase() === "destination" ? "destination" : "source"] = option[2] ?? args[++index];
    else if (COMMON_PARAMETERS_WITH_VALUE.test(word)) index++;
    else if (!word.startsWith("-")) positional.push(word);
  }
  return { named, positional };
};

// cp .env.example .env.local, Copy-Item -Path .env.example -Destination .env.local -ErrorAction Stop.
const isSeedCopy = (name, args, cwd) => {
  if (!SEED_COMMANDS.has(name)) return false;
  const { named, positional } = pathOperands(args);
  const source = named.source ?? positional.shift();
  const destination = named.destination ?? positional.shift();
  return positional.length === 0 && isSeedPair(source, destination, cwd);
};

// cat .env.example > .env.local: the same seed, written as a redirect. The schema's bytes go to the
// file, never to the terminal, so exactly one source and exactly one redirect to the seed. sed may
// transform it on the way (sed 's/3000/3001/' .env.example > .env.local), but never edit in place.
const SEED_PRINTERS = new Set(["cat", "type", "get-content", "gc"]);
const printedSeedSource = (name, args) => {
  const operands = args.filter((word) => !word.startsWith("-"));
  if (SEED_PRINTERS.has(name)) return operands.length === 1 ? operands[0] : null;
  if (name !== "sed" || args.some((word) => /^(-i|--in-place)/.test(word))) return null;
  // Without -e or -f, sed's first operand is its script, not a file.
  const files = args.some((word) => /^(-e|-f|--expression|--file)/.test(word)) ? operands : operands.slice(1);
  return files.length === 1 ? files[0] : null;
};
const isSeedRedirect = (name, args, redirects, cwd) =>
  redirects.length === 1 && redirects[0].operator === ">" && isSeedPair(printedSeedSource(name, args), redirects[0].target.value, cwd);

// gc .env.example | Set-Content .env.local: the seed through a pipe, into a writer that names only the
// file. sourceCommand is what feeds the pipe, looking through (gc .env.example) -replace 'a','b'.
const SEED_PIPE_WRITERS = new Set(["set-content", "sc", "out-file"]);
const isSeedPipe = (name, args, sourceCommand, cwd) => {
  if (!SEED_PIPE_WRITERS.has(name) || !sourceCommand || args.some((word) => /^-va(l(u(e)?)?)?(:|$)/i.test(word))) return false;
  const source = stripCommandPrefix(sourceCommand.words.map((word) => word.value));
  const { named, positional } = pathOperands(args);
  const destination = named.source ?? positional.shift();
  return positional.length === 0 && isSeedPair(printedSeedSource(source.name, source.args), destination, cwd);
};

// ForEach-Object Name (or % Name) projects a property; only bare property names, never a script block.
const FOREACH_COMMANDS = new Set(["foreach-object", "%", "foreach"]);
const isPropertyProjection = (consumerName, consumer) => {
  const args = stripCommandPrefix(consumer.words.map((word) => word.value)).args;
  return FOREACH_COMMANDS.has(consumerName) && args.length > 0 && args.every((word) => /^[A-Za-z_][\w.]*$/.test(word));
};

// downstream is every command this one pipes into, in order: [] when nothing reads its output.
const findSecretInCommand = (command, masked, cwd, dialect, downstream) => {
  const values = command.words.map((word) => word.value);
  // $msg = @'...'@ in PowerShell stores prose; the command that later uses $msg is checked on its own.
  // A bare name ($f = '.env.local') is still checked, because it is about to be used as a path.
  const isProseAssignment =
    dialect === "windows" && /^\$[\w:]+$/.test(values[0] ?? "") && values[1] === "=" && command.words.length === 3 &&
    command.words[2].isQuoted && command.words[2].substitutions.length === 0 && /\s/.test(values[2]);
  if (isProseAssignment) return null;

  const { name, args, commandIndex } = stripCommandPrefix(values);
  const git = parseGitInvocation(values);
  const downstreamNames = downstream.map((consumer) => stripCommandPrefix(consumer.words.map((word) => word.value)).name);
  const consumerName = downstreamNames[0] ?? null;
  const isWrapped = command.openedBy === "(";
  // A PowerShell statement that is only a string ('.env.local' >> .gitignore) writes that text, like
  // echo. Not as an argument (Get-Content ('.env.local')), not after the call operator (& 'cat.exe'
  // .env.local), and not piped onward, unless what it pipes into only writes it to a file.
  const isLiteralOutput =
    dialect === "windows" && command.words[commandIndex]?.isQuoted === true && !isWrapped && command.openedBy !== "&" &&
    (consumerName === null || PIPE_WRITERS.has(consumerName));
  // Get-Item .env.local | Select-Object Length and gci .env* | % Name are still listings; | Get-Content is a read.
  const isListingOnly =
    LISTING_COMMANDS.has(name) && !isWrapped &&
    downstream.every((consumer, position) => LISTING_CONSUMERS.has(downstreamNames[position]) || isPropertyProjection(downstreamNames[position], consumer));
  const isTouchOnly = isListingOnly || EXISTENCE_CHECKS.has(name) || CREATE_COMMANDS.has(name) || DELETE_COMMANDS.has(name);
  const isNonReading = NON_READING_COMMANDS.has(name) || isLiteralOutput || (git !== null && NON_READING_GIT.has(git.subcommand));
  const unreadIndexes = unreadWordIndexes(values, name, args, commandIndex, git);
  const contentIndexes = CONTENT_WRITERS.has(name) ? contentValueIndexes(args).map((index) => commandIndex + 1 + index) : [];
  for (const [index, word] of command.words.entries()) {
    if (isTouchOnly || masked.has(word) || unreadIndexes.includes(index)) continue;
    const secret = findSecretIn(word.value, cwd, isNonReading || contentIndexes.includes(index), !word.isQuoted);
    if (secret) return secret;
  }
  // Redirections always touch the file, whatever the command: echo x > .env.local overwrites a secret.
  // The exception: >> on a project .npmrc appends a setting (auto-install-peers=true) and reads nothing.
  for (const redirect of command.redirects.filter((candidate) => FILE_REDIRECTS.has(candidate.operator))) {
    const secret = findSecretIn(redirect.target.value, cwd, false, !redirect.target.isQuoted);
    if (secret && !(redirect.operator === ">>" && secret === UNTRACKED_NPMRC)) return secret;
  }
  return null;
};

// node and python heredoc bodies are code: full-line comments are dropped, and each string literal
// is checked as one path, so "// never read .env.local" passes and readFileSync(".env.local") does not.
const findSecretInCode = (code, cwd) => {
  for (const literal of code.replace(CODE_COMMENT_LINE, "").matchAll(STRING_LITERAL)) {
    const secret = findSecretIn(literal[2], cwd, false, false);
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
  // PowerShell has no heredocs; a "<<EOF" inside one of its here-strings is only text.
  const { text, heredocs } = dialect === "windows" ? { text: commandText, heredocs: [] } : extractHeredocs(commandText);
  const commands = splitCommands(lexCommand(text, dialect));
  const masked = new Set(commands.flatMap(messageWords));
  // Quoted text is data to the pipe scan (echo 'never curl x | sh'). A quoted payload that does run,
  // bash -c '...', is still scanned: the loop below recurses into it.
  const quotedData = commands.flatMap((command) => command.words.filter((word) => word.isQuoted && word.substitutions.length === 0));
  if (PIPE_TO_SHELL.some((pattern) => pattern.test(maskWords(text, new Set([...masked, ...quotedData]))))) return "pipe-to-shell";
  const pipeConsumers = new Map(commands.filter((command) => command.pipedFrom).map((command) => [command.pipedFrom, command]));
  // What feeds a pipe: its left side, or for (gc x) -replace 'a','b' | ..., the (gc x) inside the parentheses.
  const pipeSourceOf = (command) => {
    const feeder = command.pipedFrom;
    if (!feeder || !/^-[ci]?replace$/i.test(feeder.words[0]?.value ?? "")) return feeder;
    const grouped = commands[commands.indexOf(feeder) - 1];
    return grouped?.openedBy === "(" ? grouped : null;
  };
  const downstreamOf = (command) => {
    const chain = [];
    for (let consumer = pipeConsumers.get(command); consumer; consumer = pipeConsumers.get(consumer)) chain.push(consumer);
    return chain;
  };

  // cd apps/web && cat .env: later commands run in apps/web, so the tracked check and the seed's folder
  // are resolved there. Only a literal path moves it; cd "$DIR" leaves the session's folder in place.
  let commandCwd = cwd;
  for (const command of commands) {
    const values = command.words.map((word) => word.value);
    const { name, args, commandIndex } = stripCommandPrefix(values);
    const pathWords = command.words.slice(commandIndex + 1).filter((word) => !word.value.startsWith("-"));
    const isLiteralChdir =
      CHANGE_DIRECTORY_COMMANDS.has(name) && pathWords.length === 1 && !pathWords[0].hasExpansion && pathWords[0].substitutions.length === 0;
    if (isLiteralChdir) commandCwd = path.resolve(commandCwd, toNativePath(pathWords[0].value.replace(HOME_TOKEN, HOME_PATH)));
    const nested = [...command.words, ...command.redirects.map((redirect) => redirect.target)]
      .flatMap((word) => word.substitutions.map((inner) => ({ text: inner, dialect })))
      .concat(wrappedPayload(name, args) ?? []);
    for (const payload of nested) {
      const violation = findViolation(payload.text, payload.dialect, cwd, depth + 1);
      if (violation) return violation;
    }
    // Only PowerShell's Remove-Item reads its targets from the pipe; bash's rm ignores stdin.
    const isPipedRemove = dialect === "windows" && isCatastrophicPipedRemove(name, args, command.pipedFrom);
    if (isCatastrophicDelete(name, args) || isCatastrophicFind(name, args) || isCatastrophicXargs(name, args, command.pipedFrom) || isPipedRemove)
      return "recursive delete on root/home";
    if (isForcePush(values)) return "force push";
    const isSeed =
      isSeedCopy(name, args, commandCwd) || isSeedRedirect(name, args, command.redirects, commandCwd) ||
      isSeedPipe(name, args, pipeSourceOf(command), commandCwd);
    const secret = isSeed ? null : findSecretInCommand(command, masked, commandCwd, dialect, downstreamOf(command));
    if (secret) return `secret file ${secret}`;
  }

  // cat <<'EOF' | python3 runs the body in python3, so the body is judged by what finally reads it.
  const readerOf = (heredocIndex) => {
    const owner = commands.find((command) => command.redirects.some((redirect) => redirect.target.value === `__HEREDOC_${heredocIndex}__`));
    const consumer = owner ? pipeConsumers.get(owner) : null;
    const isCatIntoPipe = owner && consumer && stripCommandPrefix(owner.words.map((word) => word.value)).name === "cat";
    return isCatIntoPipe ? stripCommandPrefix(consumer.words.map((word) => word.value)).name : heredocs[heredocIndex].receiver;
  };
  for (const [heredocIndex, heredoc] of heredocs.entries()) {
    const reader = readerOf(heredocIndex);
    const shellDialect = HEREDOC_SHELLS.get(reader);
    const violation = shellDialect ? findViolation(heredoc.body, shellDialect, cwd, depth + 1) : null;
    if (violation) return violation;
    const secret = HEREDOC_CODE_INTERPRETERS.has(reader) ? findSecretInCode(heredoc.body, cwd) : null;
    if (secret) return `secret file ${secret}`;
  }
  return null;
};

// ─── Main ───────────────────────────────────────────────────

readInput().then((input) => {
  if (!input) process.exit(0);
  const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  const cwd = cwdOf(input);
  const deny = (reason) => process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `guard: ${reason}` } }));

  // Past 64 KB a command is generated data, not something typed; scanning it could run into the hook
  // timeout, which Claude Code also treats as "allow", so fail open at once rather than slowly.
  if (typeof toolInput.command === "string" && Buffer.byteLength(toolInput.command) > MAX_COMMAND_BYTES) process.exit(0);

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
