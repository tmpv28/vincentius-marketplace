// PreToolUse guard, no dependencies. Denies via JSON on stdout (exit 1 would NOT block).
// .env rule follows TV 00 #7: a committed .env is a schema, so a git-tracked .env may be read;
// every other .env* file is a secret, except the copy that seeds .env.local from the schema.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let input;
  try { input = JSON.parse(s); } catch { process.exit(0); } // fail open; permission rules still apply
  const i = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  const deny = (r) => process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "guard: " + r } }));
  const norm = (x) => String(x || "").replace(/\\/g, "/");
  const cmd = norm(i.command).replace(/(-m|--message)(\s+|=)("[^"]*"|'[^']*')/g, "$1 MSG");
  const paths = [i.file_path, i.path, i.notebook_path].filter(Boolean).map(norm);
  const ROOT = /^["']?(\/\*?|~\/?\*?|\*|\$\{?HOME\}?\/?\*?|\$env:(USERPROFILE|HOMEDRIVE|SystemDrive)\/?\*?|[a-z]:\/?\*?|\/[a-z]\/?\*?|\.\.?\/?\*?)["']?$/i;
  for (const w of cmd.split(/&&|\|\||[;\n|&]/).map((x) => x.trim().split(/\s+/).filter(Boolean))) {
    const k = w[0] === "sudo" ? w.slice(1) : w;
    const name = (k[0] || "").toLowerCase(), args = k.slice(1);
    const flags = args.filter((a) => a.startsWith("-")).join(" "), targets = args.filter((a) => !a.startsWith("-"));
    if (name === "rm" && /(^|\s)(-[a-z]*r|--recursive)/i.test(flags) && targets.some((t) => ROOT.test(t)))
      return deny("recursive rm on root/home");
    if (/^(remove-item|ri|rd|rmdir|del|erase)$/.test(name) && /-r(ecurse)?\b|\/s\b/i.test(args.join(" ")) &&
        targets.filter((t) => !/^\/[sq]$/i.test(t)).some((t) => ROOT.test(t)))
      return deny("recursive delete on root/home");
    if (name === "git" && args[0] === "push" &&
        (args.some((a) => /^(--force|-f|-[a-z]*f[a-z]*)$/.test(a)) || args.slice(1).some((a) => /^\+/.test(a))))
      return deny("force push");
  }
  if (/\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^|]*\|\s*(sudo\s+)?(\w*sh|iex|invoke-expression|pwsh|powershell|python3?|node)\b/i.test(cmd))
    return deny("pipe-to-shell");

  // Seeding .env.local from the schema copies bytes without reading them into context.
  const SEED = /^\s*(cp|copy|copy-item)(\s+-\w+)*\s+["']?(\.\/)?\.env["']?\s+["']?(\.\/)?\.env\.local["']?\s*$/i;
  if (!SEED.test(cmd)) {
    const ENV = /(^|[\/\s"'=<>])(\.env(\.(?!(example|sample|template|dist|defaults)\b)[\w.-]+)?)(?=$|[\s"'>;|&)])/g;
    const isTracked = (dir) =>
      spawnSync("git", ["-C", dir, "ls-files", "--error-unmatch", "--", ".env"], { encoding: "utf8" }).status === 0;
    const secretIn = (text, baseDir) => {
      for (const m of text.matchAll(ENV)) {
        if (m[2] !== ".env") return m[2];
        const prefix = text.slice(0, m.index + m[1].length).split(/[\s"'=<>]/).pop();
        const dir = path.resolve(baseDir, prefix || ".");
        if (!isTracked(dir)) return ".env (untracked)";
      }
      return null;
    };
    const hitCmd = secretIn(cmd, cwd);
    if (hitCmd) return deny(`secret file ${hitCmd}`);
    // Creating a file that does not exist yet cannot expose an existing secret (new schema .env).
    const creating = (p) => input.tool_name === "Write" && !fs.existsSync(path.resolve(cwd, p));
    for (const p of paths) {
      if (creating(p)) continue;
      const hit = secretIn(p, cwd);
      if (hit) return deny(`secret file ${hit}`);
    }
  }
  const SECRET = /(^|[\/\s"'])\.ssh(\/|$|[\s"'])|\.credentials\.json|\bid_(rsa|ed25519|ecdsa)\b|\.aws\/credentials/i;
  if (SECRET.test(cmd) || paths.some((p) => SECRET.test(p))) return deny("secret file");
});
