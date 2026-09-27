// Finds git's subcommand behind everything that can precede it (VAR=x, env, sudo, a path to git.exe,
// -C dir, -c key=value, --no-pager), so a rule keyed on "git push" or "git commit" sees it however
// it was spelled.
const { stripCommandPrefix } = require("./shell-command.js");

// Global options whose value is the next word; every other global option stands alone or uses "=".
const GLOBAL_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env", "--attr-source"]);

// Returns { subcommand, subcommandIndex } with the index into `words`, or null when this is not git.
const parseGitInvocation = (words) => {
  const { name, commandIndex } = stripCommandPrefix(words);
  if (name !== "git") return null;
  let index = commandIndex + 1;
  while (index < words.length && words[index].startsWith("-")) index += GLOBAL_OPTIONS_WITH_VALUE.has(words[index]) ? 2 : 1;
  return index < words.length ? { subcommand: words[index], subcommandIndex: index } : null;
};

module.exports = { parseGitInvocation };
