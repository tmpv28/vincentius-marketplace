// Shell text into simple commands, for the guards. Not a shell parser: it unquotes words and splits
// on operators well enough to find a command name and its arguments, which is all an accident guard
// needs. Two dialects: "posix" (Bash tool, bash -c) and "windows" (PowerShell tool, cmd /c), which
// differ in what a backslash means.

const HEREDOC_OPERATOR = /(?<!<)<<(-?)[ \t]*(["']?)([A-Za-z_][\w-]*)\2/g;
const HEREDOC_MARKER = /^__HEREDOC_(\d+)__$/;

// Longest first, so ">>" is never read as two ">".
const OPERATORS = ["&>>", "<<<", "&&", "||", "|&", ">>", "<<", "&>", ">&", "\n", ";", "&", "|", ">", "<", "(", ")"];
const REDIRECT_OPERATORS = new Set([">", ">>", "<", "<<", "<<<", "&>", "&>>", ">&"]);

// Wrappers that run the command after them rather than being the command.
const PREFIX_COMMANDS = new Set(["sudo", "env", "command", "exec", "nohup", "time", "builtin", "nice"]);
const PREFIX_OPTIONS_WITH_VALUE = {
  sudo: new Set(["-u", "-g", "-h", "-p", "-C", "-D", "-r", "-t", "-U", "-T", "-R"]),
  env: new Set(["-u", "-C", "-S"]),
  nice: new Set(["-n"])
};
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const commandBaseName = (word) => word.replace(/\\/g, "/").split("/").pop().toLowerCase().replace(/\.exe$/, "");

// ─── Heredocs ───────────────────────────────────────────────

const receiverOf = (textBeforeOperator) => {
  const segment = textBeforeOperator.split(/[;&|\n(]/).pop();
  const command = splitCommands(lexCommand(segment)).pop();
  return command ? stripCommandPrefix(command.words.map((word) => word.value)).name : "";
};

// Swaps each heredoc body for a marker word, so text written into a file is never read as commands,
// while the bodies stay available to whoever needs them: a commit message, or a shell's stdin.
const extractHeredocs = (command) => {
  const heredocs = [];
  let text = "";
  let cursor = 0;
  HEREDOC_OPERATOR.lastIndex = 0;
  for (let match = HEREDOC_OPERATOR.exec(command); match; match = HEREDOC_OPERATOR.exec(command)) {
    const operatorEnd = match.index + match[0].length;
    const lineEnd = command.indexOf("\n", operatorEnd);
    if (lineEnd === -1) break;
    const delimiter = match[3];
    // The whole line must be the delimiter, so "EOF marks the end" inside a body does not end it;
    // only <<- lets tabs indent it.
    const terminator = new RegExp(`^${match[1] === "-" ? "\\t*" : ""}${delimiter}[ \\t]*\\r?$`, "m").exec(command.slice(lineEnd + 1));
    const bodyEnd = terminator ? lineEnd + 1 + terminator.index : command.length;
    heredocs.push({
      delimiter,
      body: command.slice(lineEnd + 1, bodyEnd).replace(/\n$/, ""),
      receiver: receiverOf(command.slice(cursor, match.index))
    });
    text += `${command.slice(cursor, match.index)}<<__HEREDOC_${heredocs.length - 1}__${command.slice(operatorEnd, lineEnd + 1)}`;
    cursor = terminator ? bodyEnd + terminator[0].length : command.length;
    HEREDOC_OPERATOR.lastIndex = cursor;
  }
  return { text: text + command.slice(cursor), heredocs };
};

// ─── Words ──────────────────────────────────────────────────

// Each word carries its unquoted value, its span in `text`, the command substitutions inside it
// ($(...), backticks, <(...)), whether anything in it expands at run time, and whether any of it was quoted.
const lexCommand = (text, dialect = "posix") => {
  const isPosix = dialect === "posix";
  const tokens = [];
  let word = null;
  let index = 0;

  const openWord = (start) => {
    if (!word) word = { type: "word", value: "", start, end: start, substitutions: [], hasExpansion: false, isQuoted: false };
    return word;
  };
  const closeWord = (end) => {
    if (word) tokens.push({ ...word, end });
    word = null;
  };
  const findClosingParen = (openParen) => {
    let depth = 0;
    for (let cursor = openParen; cursor < text.length; cursor++) {
      if (text[cursor] === "'") {
        const close = text.indexOf("'", cursor + 1);
        if (close === -1) return text.length;
        cursor = close;
      } else if (text[cursor] === "(") depth++;
      else if (text[cursor] === ")" && --depth === 0) return cursor;
    }
    return text.length;
  };
  const readSubstitution = (start, innerStart, innerEnd, resumeAt) => {
    const current = openWord(start);
    current.value += text.slice(start, resumeAt);
    current.substitutions.push(text.slice(innerStart, innerEnd));
    current.hasExpansion = true;
    return resumeAt;
  };
  const readParenthesized = (start) => {
    const close = findClosingParen(start + 1);
    return readSubstitution(start, start + 2, close, Math.min(close + 1, text.length));
  };
  const readBackticks = (start) => {
    const close = text.indexOf("`", start + 1);
    const innerEnd = close === -1 ? text.length : close;
    return readSubstitution(start, start + 1, innerEnd, Math.min(innerEnd + 1, text.length));
  };
  const markExpansion = (cursor) => {
    if (text[cursor] === "$" && /[A-Za-z_{]/.test(text[cursor + 1] ?? "")) openWord(cursor).hasExpansion = true;
  };
  const readDoubleQuoted = (start) => {
    const current = openWord(start);
    current.isQuoted = true;
    let cursor = start + 1;
    while (cursor < text.length && text[cursor] !== '"') {
      const char = text[cursor];
      const next = text[cursor + 1] ?? "";
      if (isPosix && char === "\\" && '"\\$`'.includes(next) && next !== "") {
        current.value += next;
        cursor += 2;
      } else if (!isPosix && char === "`" && next !== "") {
        current.value += next;
        cursor += 2;
      } else if (char === "$" && next === "(") cursor = readParenthesized(cursor);
      else if (isPosix && char === "`") cursor = readBackticks(cursor);
      else {
        markExpansion(cursor);
        current.value += char;
        cursor++;
      }
    }
    return cursor + 1;
  };

  // PowerShell's @'...'@ and @"..."@: the body runs from the line after the opener to a line
  // starting with the closer. Returns the index after the closer, or -1 when this is not one.
  const readHereString = (start) => {
    const quote = text[start + 1];
    const opener = /^\r?\n/.exec(text.slice(start + 2));
    if (!opener) return -1;
    const bodyStart = start + 2 + opener[0].length;
    const closer = new RegExp(`\\r?\\n${quote}@`).exec(text.slice(bodyStart));
    if (!closer) return -1;
    const current = openWord(start);
    const body = text.slice(bodyStart, bodyStart + closer.index);
    current.value += body;
    current.isQuoted = true;
    if (quote === '"' && /\$[A-Za-z_{(]/.test(body)) current.hasExpansion = true;
    return bodyStart + closer.index + closer[0].length;
  };

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1] ?? "";
    const hereStringEnd = !isPosix && !word && char === "@" && (next === "'" || next === '"') ? readHereString(index) : -1;
    if (hereStringEnd !== -1) index = hereStringEnd;
    else if (char === "'") {
      const close = text.indexOf("'", index + 1);
      const stop = close === -1 ? text.length : close;
      const current = openWord(index);
      current.value += text.slice(index + 1, stop);
      current.isQuoted = true;
      index = stop + 1;
    } else if (char === '"') index = readDoubleQuoted(index);
    else if (isPosix && char === "\\" && next === "\n") index += 2;
    else if ((isPosix ? char === "\\" : char === "`") && next !== "") {
      // Bash drops an unquoted backslash and keeps the next character; PowerShell does that with a backtick.
      openWord(index).value += next;
      index += 2;
    } else if ("$<>".includes(char) && next === "(") index = readParenthesized(index);
    else if (isPosix && char === "`") index = readBackticks(index);
    else if (char === "#" && !word) {
      const lineEnd = text.indexOf("\n", index);
      index = lineEnd === -1 ? text.length : lineEnd;
    } else if (char === " " || char === "\t" || char === "\r") {
      closeWord(index);
      index++;
    } else {
      const operator = OPERATORS.find((candidate) => text.startsWith(candidate, index));
      if (operator) {
        // The 2 in 2>&1 is a file descriptor, not an argument.
        if (word && /^\d+$/.test(word.value) && /^[<>]/.test(operator)) word = null;
        closeWord(index);
        tokens.push({ type: "op", value: operator === "|&" ? "|" : operator });
        index += operator.length;
      } else {
        markExpansion(index);
        openWord(index).value += char;
        index++;
      }
    }
  }
  closeWord(index);
  return tokens;
};

// ─── Commands ───────────────────────────────────────────────

// Groups tokens into simple commands: { words, redirects, pipedFrom }, where pipedFrom is the
// command whose output this one reads through a pipe.
const splitCommands = (tokens) => {
  const commands = [];
  const newCommand = (pipedFrom) => ({ words: [], redirects: [], pipedFrom });
  let current = newCommand(null);
  let pendingRedirect = null;
  for (const token of tokens) {
    if (token.type === "word") {
      if (pendingRedirect) current.redirects.push({ operator: pendingRedirect, target: token });
      else current.words.push(token);
      pendingRedirect = null;
    } else if (REDIRECT_OPERATORS.has(token.value)) pendingRedirect = token.value;
    else {
      const isEmpty = current.words.length === 0 && current.redirects.length === 0;
      if (!isEmpty) commands.push(current);
      current = newCommand(token.value === "|" && !isEmpty ? current : null);
      pendingRedirect = null;
    }
  }
  if (current.words.length > 0 || current.redirects.length > 0) commands.push(current);
  return commands;
};

// Skips assignments and wrappers (VAR=x, sudo -u root, env, command, nohup) to the real command.
const stripCommandPrefix = (words) => {
  let index = 0;
  while (index < words.length) {
    if (ASSIGNMENT.test(words[index])) {
      index++;
      continue;
    }
    const wrapper = commandBaseName(words[index]);
    if (!PREFIX_COMMANDS.has(wrapper)) break;
    const optionsWithValue = PREFIX_OPTIONS_WITH_VALUE[wrapper] ?? new Set();
    index++;
    while (index < words.length && (words[index].startsWith("-") || (wrapper === "env" && ASSIGNMENT.test(words[index])))) {
      const option = words[index++];
      if (option === "--") break;
      if (optionsWithValue.has(option)) index++;
    }
  }
  return {
    name: index < words.length ? commandBaseName(words[index]) : "",
    args: words.slice(index + 1),
    commandIndex: index
  };
};

module.exports = { HEREDOC_MARKER, commandBaseName, extractHeredocs, lexCommand, splitCommands, stripCommandPrefix };
