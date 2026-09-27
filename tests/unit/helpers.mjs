import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const HOOK = (name) => join(REPO, "kit", "hooks", "tv", name);

// Characters kept out of the test sources as literals: code-adjacent text bans the em-dash (00 #5),
// and a literal backslash is the character most often mangled between shells and editors.
export const EM_DASH = String.fromCharCode(0x2014);
export const BACKSLASH = String.fromCharCode(92);

export const runHook = (name, input, env = {}) => {
  const result = spawnSync(process.execPath, [HOOK(name)], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

export const isDenied = (result) => result.stdout.includes('"deny"');

export const makeTempDir = (prefix) => mkdtempSync(join(tmpdir(), `vm-${prefix}-`));

// A git repo whose .env is committed (a schema, per TV 00 #7) or merely present (a secret).
export const makeEnvRepo = (tracked) => {
  const dir = makeTempDir(tracked ? "env-tracked" : "env-untracked");
  const git = (...args) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git("init", "-q");
  writeFileSync(join(dir, ".env"), tracked ? "API_KEY=\n" : "API_KEY=real-value\n");
  if (tracked) {
    git("add", ".env");
    git("-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-q", "-m", "init");
  }
  return dir;
};

export const makePackage = (name, stdCheckScript) => {
  const dir = makeTempDir(name);
  mkdirSync(dir, { recursive: true });
  if (stdCheckScript !== null)
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, scripts: { "std:check": stdCheckScript } }));
  return dir;
};
