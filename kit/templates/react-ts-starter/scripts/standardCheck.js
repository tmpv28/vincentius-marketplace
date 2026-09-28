import { execSync } from "child_process";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { printBanner, ACCENT } from "./branding.js";

// ─── Constants ─────────────────────────────────────────────

// scripts/ and the tool configs are linted too, so the code that builds and checks the app is held
// to the rules it enforces.
const ESLINT_TARGETS =
  '"src/**/*.{js,jsx,ts,tsx}" "scripts/**/*.js" vite.config.ts vitest.setup.ts ".storybook/**/*.ts"';
// The app and the tool configs compile under different settings (the configs sit outside src/,
// which the app config roots at), so each project is checked on its own.
const TSC_PROJECTS = ["tsconfig.json", "tsconfig.node.json"];
// One definition of "a line ESLint emitted for a finding", used by every pass over its output.
const ISSUE_LINE_PATTERN = /^\s*\d+:\d+\s+(error|warning)\s+/;
const ERROR_LINE_PATTERN = /^\s*\d+:\d+\s+error\s+/;
const WARNING_LINE_PATTERN = /^\s*\d+:\d+\s+warning\s+/;
const DIVIDER = chalk.dim(`  ${"─".repeat(40)}`);
const STEP_ICON_OK = chalk.green("  ✔");
const STEP_ICON_FAIL = chalk.red("  ✖");
const STEP_ICON_WARN = chalk.yellow("  ⚠");

// ─── Helpers ───────────────────────────────────────────────

function runCommand(command) {
  try {
    const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });
    return { success: true, output, status: 0 };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || "",
      stderr: error.stderr || "",
      status: error.status ?? null
    };
  }
}

function getFullOutput(result) {
  return (result.output + (result.stderr || "")).trim();
}

function extractIssueLines(output) {
  const issueLines = new Set();
  output.split("\n").forEach((line) => {
    if (ISSUE_LINE_PATTERN.test(line.trim())) {
      issueLines.add(line.trim());
    }
  });
  return issueLines;
}

function deduplicateAndClean(output, seen) {
  const lines = output.split("\n");
  const filtered = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const trimmed = lines[lineIndex].trim();

    if (ISSUE_LINE_PATTERN.test(trimmed) && seen.has(trimmed)) {
      lineIndex += 1;
    } else if (/^[✖✗✘]\s+\d+\s+problem/.test(trimmed)) {
      lineIndex += 1;
    } else {
      const isFilePath = /^\S.*\.\w+$/.test(trimmed) && !/^\d+:\d+/.test(trimmed);
      if (isFilePath) {
        let nextContentIndex = lineIndex + 1;
        while (nextContentIndex < lines.length && /^\s*$/.test(lines[nextContentIndex]))
          nextContentIndex += 1;
        const nextHasContent =
          nextContentIndex < lines.length && /^\s*\d+:\d+/.test(lines[nextContentIndex]);
        if (!nextHasContent) {
          lineIndex = nextContentIndex;
        } else {
          filtered.push(lines[lineIndex]);
          lineIndex += 1;
        }
      } else {
        filtered.push(lines[lineIndex]);
        lineIndex += 1;
      }
    }
  }

  return filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractErrorLocations(output) {
  const locations = new Set();
  let currentFile = "";
  output.split("\n").forEach((line) => {
    // Prettier: "[error] src/file.tsx: SyntaxError: ... (55:37)"
    const prettierMatch = line.match(/\[error\]\s+(.+?):\s+\S+Error.*\((\d+):(\d+)\)/);
    if (prettierMatch) {
      locations.add(`${prettierMatch[1].replace(/\\/g, "/")}:${prettierMatch[2]}`);
    }
    // ESLint: file path line followed by "  55:37  error  message  rule-name"
    const [, filePath] = line.match(/^(\S.*\.\w+)$/) || [];
    if (filePath) {
      currentFile = filePath;
    }
    const eslintMatch = line.trim().match(/^(\d+):\d+\s+error\s+/);
    if (eslintMatch && currentFile) {
      locations.add(`${currentFile.replace(/\\/g, "/")}:${eslintMatch[1]}`);
    }
  });
  return locations;
}

function filterTscOutput(tscOutput, seenLocations) {
  if (seenLocations.size === 0) return tscOutput;
  return tscOutput
    .split("\n")
    .filter((line) => {
      // TSC: "src/file.tsx(55,37): error TS1005: ..."
      const tscMatch = line.match(/^(.+?)\((\d+),\d+\):\s+error\s+/);
      if (tscMatch) {
        const errorLocation = `${tscMatch[1].replace(/\\/g, "/")}:${tscMatch[2]}`;
        return !seenLocations.has(errorLocation);
      }
      return true;
    })
    .join("\n")
    .trim();
}

function hasActualIssues(output) {
  return output.split("\n").some((line) => ISSUE_LINE_PATTERN.test(line.trim()));
}

// ESLint exits non-zero with parseable "line:col error" lines for real lint findings.
// A non-zero exit with no such lines means ESLint itself failed to run (crash, bad config, missing plugin).
function isLinterCrash(result) {
  return !result.success && !hasActualIssues(getFullOutput(result));
}

function countIssues(output) {
  let errors = 0;
  let warnings = 0;
  output.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (ERROR_LINE_PATTERN.test(trimmed)) errors += 1;
    if (WARNING_LINE_PATTERN.test(trimmed)) warnings += 1;
  });
  return { errors, warnings };
}

function colorizeLine(line) {
  const trimmed = line.trim();

  // File path lines (e.g. "C:\...\file.tsx")
  if (/^\S.*\.\w+$/.test(trimmed) && !/^\d+:\d+/.test(trimmed)) {
    return `  ${chalk.underline.cyan(trimmed)}`;
  }

  // Error lines (e.g. "  10:5  error  message  rule-name")
  const errorMatch = trimmed.match(/^(\d+:\d+)\s+(error)\s+(.+?)\s{2,}(\S+)$/);
  if (errorMatch) {
    return `    ${chalk.dim(errorMatch[1])}  ${chalk.red.bold("error")}  ${chalk.white(errorMatch[3])}  ${chalk.dim(errorMatch[4])}`;
  }

  // Warning lines (e.g. "  10:5  warning  message  rule-name")
  const warnMatch = trimmed.match(/^(\d+:\d+)\s+(warning)\s+(.+?)\s{2,}(\S+)$/);
  if (warnMatch) {
    return `    ${chalk.dim(warnMatch[1])}  ${chalk.yellow("warning")}  ${chalk.white(warnMatch[3])}  ${chalk.dim(warnMatch[4])}`;
  }

  return `  ${line}`;
}

function colorizeOutput(output) {
  if (!output) return "";
  return output
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map(colorizeLine)
    .join("\n");
}

function printStepHeader(label) {
  console.log(chalk.hex(ACCENT).bold(`  ${label}`));
  console.log(`${DIVIDER}\n`);
}

function collectFiles(dir, list = []) {
  readdirSync(dir).forEach((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules") collectFiles(full, list);
    } else {
      list.push(full);
    }
  });
  return list;
}

function checkMergeConflicts() {
  const conflictPattern = /^(<{7}|={7}|>{7})/;
  const conflicts = {};

  collectFiles("src").forEach((filePath) => {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, lineIndex) => {
      if (conflictPattern.test(line)) {
        const normalized = filePath.replace(/\\/g, "/");
        if (!conflicts[normalized]) conflicts[normalized] = [];
        conflicts[normalized].push({ line: String(lineIndex + 1), marker: line.trim() });
      }
    });
  });

  return Object.keys(conflicts).length > 0 ? conflicts : null;
}

function printConflictReport(conflicts) {
  Object.entries(conflicts).forEach(([file, markers]) => {
    console.log(`  ${chalk.underline.cyan(file)}`);
    markers.forEach(({ line, marker }) => {
      let styled;
      if (marker.startsWith("<<<<<<<")) styled = chalk.red.bold(marker);
      else if (marker.startsWith("=======")) styled = chalk.yellow(marker);
      else if (marker.startsWith(">>>>>>>")) styled = chalk.green.bold(marker);
      else styled = chalk.white(marker);
      console.log(`    ${chalk.dim(line)}  ${styled}`);
    });
    console.log("");
  });
}

// Stylelint's JSON report, re-emitted in ESLint's line shape so one counter and one colouriser
// serve both linters. Returns null when the output is not a report at all, which means stylelint
// itself failed to run, and the caller says so instead of reading it as a pass.
function formatStylelintReport(output) {
  const reportStart = output.indexOf("[");
  if (reportStart === -1) return null;

  let fileResults;
  try {
    fileResults = JSON.parse(output.slice(reportStart));
  } catch (parseError) {
    console.log(chalk.red(`  Stylelint output was not JSON: ${parseError.message}`));
    return null;
  }

  return fileResults
    .filter((fileResult) => fileResult.warnings.length > 0)
    .map((fileResult) =>
      [
        fileResult.source,
        ...fileResult.warnings.map(
          ({ line, column, severity, text, rule }) =>
            `  ${line}:${column}  ${severity}  ${text.replace(` (${rule})`, "")}  ${rule}`
        )
      ].join("\n")
    )
    .join("\n\n");
}

function printSummaryLine(errors, warnings) {
  const parts = [];
  if (errors > 0) parts.push(chalk.red.bold(`${errors} error${errors > 1 ? "s" : ""}`));
  if (warnings > 0) parts.push(chalk.yellow.bold(`${warnings} warning${warnings > 1 ? "s" : ""}`));
  if (parts.length > 0) {
    const content = `${chalk.white.bold("Total")} ${chalk.dim("›")} ${parts.join(chalk.dim(" · "))}`;
    const plainParts = [];
    if (errors > 0) plainParts.push(`${errors} error${errors > 1 ? "s" : ""}`);
    if (warnings > 0) plainParts.push(`${warnings} warning${warnings > 1 ? "s" : ""}`);
    const boxWidth = `Total › ${plainParts.join(" · ")}`.length + 2;
    const dim = chalk.dim;
    console.log("");
    console.log(`  ${dim(`┌${"─".repeat(boxWidth)}┐`)}`);
    console.log(`  ${dim("│")} ${content} ${dim("│")}`);
    console.log(`  ${dim(`└${"─".repeat(boxWidth)}┘`)}`);
  }
}

// ─── Main ──────────────────────────────────────────────────

const allSeen = new Set();
let totalErrors = 0;
let totalWarnings = 0;
let hasFatalFailure = false;

console.log("");
printBanner();
console.log("\n");

// ─── Step 0: Merge Conflict Detection ─────────────────────

const conflicts = checkMergeConflicts();

if (conflicts) {
  printStepHeader("Merge conflict detection...");
  printConflictReport(conflicts);

  const fileCount = Object.keys(conflicts).length;
  const conflictCount = Object.values(conflicts).reduce(
    (sum, markers) => sum + markers.filter(({ marker }) => marker.startsWith("<<<<<<<")).length,
    0
  );

  console.log(
    `${STEP_ICON_FAIL} ${chalk.red.bold("Code health check? This code is already on life support.")}`
  );
  console.log(
    chalk.dim("    Resolve all merge conflicts first, then run the health check again.\n")
  );

  const dim = chalk.dim;
  const summary = `${conflictCount} conflict${conflictCount > 1 ? "s" : ""} in ${fileCount} file${fileCount > 1 ? "s" : ""}`;
  const boxWidth = summary.length + 2;
  console.log(`  ${dim(`┌${"─".repeat(boxWidth)}┐`)}`);
  console.log(`  ${dim("│")} ${chalk.white.bold(summary)} ${dim("│")}`);
  console.log(`  ${dim(`└${"─".repeat(boxWidth)}┘`)}`);
  console.log("\n");
  process.exit(1);
}

// ─── Step 0b: Em-dashes in code-adjacent text ─────────────

// TV 00 #5 is a non-negotiable, so it is a gate here rather than a notice. Built from its char code
// so this file does not trip its own check.
const EM_DASH = String.fromCharCode(0x2014);
const CODE_ADJACENT_PATTERN = /\.(tsx?|jsx?|mjs|cjs|s?css|html)$/;

// The rule covers every code-adjacent file, so the tooling and the root configs are scanned too;
// the root is read one level deep, because below it only these folders hold code.
const EM_DASH_SCANNED_FILES = [
  ...collectFiles("src"),
  ...collectFiles("scripts"),
  ...collectFiles(".storybook"),
  ...readdirSync(".").filter((entry) => statSync(entry).isFile())
];

const emDashHits = EM_DASH_SCANNED_FILES.filter((filePath) =>
  CODE_ADJACENT_PATTERN.test(filePath)
).flatMap((filePath) =>
  readFileSync(filePath, "utf-8")
    .split("\n")
    .map((line, index) =>
      line.includes(EM_DASH) ? `${filePath.replace(/\\/g, "/")}:${index + 1}` : null
    )
    .filter(Boolean)
);

if (emDashHits.length > 0) {
  printStepHeader("Em-dash check...");
  emDashHits.forEach((hit) => console.log(`  ${chalk.underline.cyan(hit)}`));
  console.log(
    `\n${STEP_ICON_FAIL} ${chalk.red.bold("Em-dashes in code. Use a period, a semicolon or a colon.")}\n\n`
  );
  hasFatalFailure = true;
}

// ─── Step 1: Formatting ───────────────────────────────────

printStepHeader("Formatting & auto-fixing...");

const prettierResult = runCommand("pnpm exec prettier --write --log-level warn . 2>&1");
const eslintFixResult = runCommand(`pnpm exec eslint --fix ${ESLINT_TARGETS} 2>&1`);

const prettierOutput = getFullOutput(prettierResult);
const eslintFixOutput = getFullOutput(eslintFixResult);

extractIssueLines(eslintFixOutput).forEach((line) => allSeen.add(line));

const fixHasIssues = hasActualIssues(eslintFixOutput);
const fixCounts = countIssues(eslintFixOutput);

if (!prettierResult.success && prettierOutput) {
  const prettierErrors = prettierOutput
    .split("\n")
    .filter((l) => l.trim().length > 0 && !l.includes("(unchanged)") && !l.includes("(changed)"))
    .join("\n")
    .trim();
  if (prettierErrors) {
    console.log(chalk.red(prettierErrors));
  }
  hasFatalFailure = true;
}

if (isLinterCrash(eslintFixResult)) {
  if (eslintFixOutput) console.log(chalk.red(eslintFixOutput));
  console.log(
    `\n\n${STEP_ICON_FAIL} ${chalk.red.bold("ESLint failed to run. Fix the linter setup before continuing.")}`
  );
  hasFatalFailure = true;
} else if (fixHasIssues) {
  const cleaned = deduplicateAndClean(eslintFixOutput, new Set());
  if (cleaned) console.log(colorizeOutput(cleaned));
  totalErrors += fixCounts.errors;
  totalWarnings += fixCounts.warnings;
  if (!eslintFixResult.success && fixCounts.errors > 0) hasFatalFailure = true;
  const icon = fixCounts.errors > 0 ? STEP_ICON_FAIL : STEP_ICON_WARN;
  console.log(`\n\n${icon} ${chalk.dim("Formatted, but found issues that need attention.")}`);
} else if (prettierResult.success) {
  console.log(`${STEP_ICON_OK} ${chalk.green("Spotless. Not a single crumb out of place.")}`);
}

const seenErrorLocations = extractErrorLocations(`${prettierOutput}\n${eslintFixOutput}`);

// ─── Step 2: Type Checking ────────────────────────────────

console.log("\n");
printStepHeader("Type checking...");

const tscResults = TSC_PROJECTS.map((project) =>
  runCommand(`pnpm exec tsc --noEmit --skipLibCheck -p ${project} 2>&1`)
);
const tscResult = { success: tscResults.every((result) => result.success) };
const tscRawOutput = tscResults
  .map((result) => getFullOutput(result))
  .filter((output) => output.length > 0)
  .join("\n");
const tscOutput = filterTscOutput(tscRawOutput, seenErrorLocations);

// A non-zero tsc exit always means broken types (or a crashed compiler); never let empty
// filtered output slip through as a pass. Output presence only decides which message to print.
if (!tscResult.success) {
  if (tscOutput) {
    console.log(tscOutput);
    console.log(`\n\n${STEP_ICON_FAIL} ${chalk.dim("TypeScript found type errors.")}`);
  } else if (tscRawOutput) {
    // tsc reported errors, but every location was already surfaced by prettier/eslint above.
    console.log(
      `\n\n${STEP_ICON_FAIL} ${chalk.dim("TypeScript found type errors (already reported above).")}`
    );
  } else {
    // Non-zero exit with no output at all: the compiler itself failed to run.
    console.log(
      `\n\n${STEP_ICON_FAIL} ${chalk.red.bold("TypeScript failed to run. Fix the tsc setup before continuing.")}`
    );
  }
  hasFatalFailure = true;
} else {
  console.log(`${STEP_ICON_OK} ${chalk.green("Types check out. The compiler is pleased.")}`);
}

// ─── Step 3: Linting (report only, no fix) ────────────────

console.log("\n");
printStepHeader("Lint check...");

const eslintResult = runCommand(`pnpm exec eslint ${ESLINT_TARGETS} 2>&1`);
const eslintRaw = getFullOutput(eslintResult);
const eslintCleaned = deduplicateAndClean(eslintRaw, allSeen);
const eslintHasNew = hasActualIssues(eslintCleaned);

if (isLinterCrash(eslintResult)) {
  if (eslintRaw) console.log(chalk.red(eslintRaw));
  console.log(
    `\n\n${STEP_ICON_FAIL} ${chalk.red.bold("ESLint failed to run. Fix the linter setup before continuing.")}`
  );
  hasFatalFailure = true;
} else if (eslintHasNew) {
  const newCounts = countIssues(eslintCleaned);
  console.log(colorizeOutput(eslintCleaned));
  totalErrors += newCounts.errors;
  totalWarnings += newCounts.warnings;
  const icon = newCounts.errors > 0 ? STEP_ICON_FAIL : STEP_ICON_WARN;
  console.log(`\n\n${icon} ${chalk.dim("Linter found issues.")}`);
  if (!eslintResult.success && newCounts.errors > 0) hasFatalFailure = true;
} else {
  console.log(`${STEP_ICON_OK} ${chalk.green("All clear. Linter has nothing to complain about.")}`);
}

// ─── Step 4: Style linting (report only, no fix) ──────────

console.log("\n");
printStepHeader("Style check...");

// Stylelint 16 writes its report to stderr, so it is folded into stdout to be read at all.
const stylelintResult = runCommand('pnpm exec stylelint "src/**/*.scss" --formatter json 2>&1');
const stylelintReport = formatStylelintReport(getFullOutput(stylelintResult));

if (stylelintReport === null) {
  console.log(chalk.red(getFullOutput(stylelintResult)));
  console.log(
    `\n\n${STEP_ICON_FAIL} ${chalk.red.bold("Stylelint failed to run. Fix the style linter setup before continuing.")}`
  );
  hasFatalFailure = true;
} else if (hasActualIssues(stylelintReport)) {
  const styleCounts = countIssues(stylelintReport);
  console.log(colorizeOutput(stylelintReport));
  totalErrors += styleCounts.errors;
  totalWarnings += styleCounts.warnings;
  const icon = styleCounts.errors > 0 ? STEP_ICON_FAIL : STEP_ICON_WARN;
  console.log(`\n\n${icon} ${chalk.dim("Style linter found issues.")}`);
  if (styleCounts.errors > 0) hasFatalFailure = true;
} else {
  console.log(`${STEP_ICON_OK} ${chalk.green("Styles hold. Stylelint has no notes.")}`);
}

// ─── Final Summary ─────────────────────────────────────────

console.log("\n");

if (totalErrors === 0 && totalWarnings === 0 && !hasFatalFailure) {
  console.log(`  ${chalk.green.bold("🚀 Ship it. PR time!")}`);
} else {
  printSummaryLine(totalErrors, totalWarnings);
}

console.log("\n");

if (hasFatalFailure) process.exit(1);
