// The gate's first step writes: prettier --write, then eslint --fix. It writes to the working
// tree, and git commits the index, so a commit can carry content the gate would have rejected
// while the working tree sitting in front of you is clean.
//
// The obvious check compares the staged list against what has unstaged changes after the gate
// runs. That is wrong: the intersection is non-empty for any file staged in part, which is
// ordinary when one commit carries one reason and one file carries two. It refused correct
// commits, which is worse than the hole it closed, because a gate that cries wolf earns
// --no-verify by habit and then never catches the real case.
//
// The check that answers the actual question runs the mutating tools against the staged content
// itself. Only the files whose index copy differs from the working tree need it: everything else
// is byte-identical to a tree the gate has just declared clean.

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { ESLint } from "eslint";
import * as prettier from "prettier";

// ─── Constants ─────────────────────────────────────────────

const LINTABLE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

// ─── Helpers ───────────────────────────────────────────────

// No shell. Paths reach these arguments unescaped, and this repository lives under one that
// contains a space.
const runGit = (args) => spawnSync("git", args, { encoding: "buffer", windowsHide: true });

const getStagedPaths = () => {
  const result = runGit(["diff", "--cached", "--name-only", "--diff-filter=d"]);

  // An empty list would read as "nothing staged, nothing to check" and let the commit through, so
  // a git that cannot answer stops the commit instead.
  if (result.error || result.status !== 0) {
    const gitOutput = result.error?.message ?? result.stderr.toString("utf8").trim();
    console.log("");
    console.log("  Commit blocked. Could not list the staged files, so nothing was checked:");
    console.log("");
    console.log(`    ${gitOutput || `git exited with status ${result.status}`}`);
    console.log("");
    process.exit(1);
  }

  return result.stdout
    .toString("utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

// The index copy, byte for byte. Buffer rather than string so a line-ending difference is one.
const readStagedContent = (path) => {
  const result = runGit(["show", `:${path}`]);
  return result.status === 0 ? result.stdout : null;
};

const readWorkingTreeContent = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

// A file prettier has no parser for, or one its ignore file excludes, is not dirty. The gate's
// own prettier run did not touch it either.
const isPrettierClean = async (path, source) => {
  const fileInfo = await prettier.getFileInfo(path, { resolveConfig: true });
  if (fileInfo.ignored || fileInfo.inferredParser === null) return true;

  const configs = await prettier.resolveConfig(path);
  return prettier.check(source, { ...configs, filepath: path });
};

// `output` is set only when --fix would have written something, which is exactly the drift this
// check exists to find. Lint errors that are not auto-fixable belong to the gate's report step.
const isEslintClean = async (path, source) => {
  if (!LINTABLE_EXTENSIONS.some((extension) => path.endsWith(extension))) return true;

  const eslint = new ESLint({ fix: true });
  if (await eslint.isPathIgnored(path)) return true;

  const [report] = await eslint.lintText(source, { filePath: path });
  return !report || report.output === undefined;
};

const isStagedCopyClean = async (path) => {
  const stagedContent = readStagedContent(path);
  if (stagedContent === null) return true;

  const workingTreeContent = readWorkingTreeContent(path);
  if (workingTreeContent !== null && stagedContent.equals(workingTreeContent)) return true;

  const source = stagedContent.toString("utf8");
  return (await isPrettierClean(path, source)) && (await isEslintClean(path, source));
};

// ─── Main ──────────────────────────────────────────────────

const stagedPaths = getStagedPaths();
const cleanliness = await Promise.all(stagedPaths.map((path) => isStagedCopyClean(path)));
const unformattedStagedFiles = stagedPaths.filter((path, index) => !cleanliness[index]);

if (unformattedStagedFiles.length > 0) {
  console.log("");
  console.log("  Commit blocked. What you staged is not what the gate produces:");
  console.log("");
  unformattedStagedFiles.forEach((path) => console.log(`    ${path}`));
  console.log("");
  console.log("  The working tree is clean and the index is not, so the commit would carry the");
  console.log("  unformatted version. Re-stage these files and commit again.");
  process.exit(1);
}
