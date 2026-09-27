import { readFileSync } from "fs";
import chalk from "chalk";

// ─── Constants ─────────────────────────────────────────────

export const ACCENT = "#67BBDE";
export const ACCENT_ALT = "#E21E25";

const { name: PACKAGE_NAME } = JSON.parse(readFileSync("package.json", "utf-8"));
const APP_NAME = PACKAGE_NAME.replace(/[-_]/g, " ").toUpperCase();

// ─── Helpers ───────────────────────────────────────────────

const accent = chalk.hex(ACCENT).bold;
const dim = chalk.dim;

// The banner is a fixed-width box, so every line is padded against its VISIBLE length.
// Chalk escape codes inflate string length; never pad against the styled string.
function padToBoxWidth(styledText, visibleLength, boxWidth) {
  const wall = dim("│");
  return `  ${wall}${styledText}${" ".repeat(Math.max(boxWidth - visibleLength, 0))}${wall}`;
}

// ─── Exports ───────────────────────────────────────────────

export function printAppLogo() {
  console.log(`\n\n\n${dim("|")} ${accent(APP_NAME)}\n\n`);
}

export function printBanner() {
  const label = chalk.green.italic("Code Health Check");
  const title = ` ${APP_NAME}`;
  const boxWidth = Math.max(title.length + "   Code Health Check".length, 54);
  const horizontalRule = "─".repeat(boxWidth);

  console.log(dim(`  ┌${horizontalRule}┐`));
  console.log(
    padToBoxWidth(`${accent(title)}   ${label}`, `${title}   Code Health Check`.length, boxWidth)
  );
  console.log(dim(`  └${horizontalRule}┘`));
}
