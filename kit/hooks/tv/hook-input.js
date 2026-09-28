// The JSON Claude Code sends a hook on stdin. Every hook fails open, so anything unreadable, or JSON
// that is not an object, resolves to null and the hook exits 0, leaving the permission rules in charge.

// Resolves to the parsed input object, or null.
const readInput = () =>
  new Promise((resolve) => {
    let raw = "";
    // Decoded by the stream, so a multibyte character split across two chunks arrives whole.
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
      try {
        const input = JSON.parse(raw);
        resolve(input && typeof input === "object" && !Array.isArray(input) ? input : null);
      } catch {
        resolve(null);
      }
    });
  });

const cwdOf = (input) => (typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : process.cwd());

module.exports = { readInput, cwdOf };
