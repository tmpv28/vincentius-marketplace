// Estimates the always-loaded skill listing: every model-invocable skill's name + description, against
// the listing budget (skillListingBudgetFraction of the context window, default 1%).
//   node scripts/listing-budget.mjs [--context <tokens>] [--json]
// Claude Code's /skill-doctor is the authority; this is the check a script can run unattended.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const CONFIG = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const contextTokens = Number(args[args.indexOf("--context") + 1]) || 1000000;
const readSettings = () => {
  const path = join(CONFIG, "settings.json");
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { console.error(`✖  ${path} is not valid JSON (${error.message}); using the defaults`); return {}; }
};
const settings = readSettings();
const fraction = settings.skillListingBudgetFraction ?? 0.01;
const PER_SKILL_CAP = settings.skillListingMaxDescChars ?? 1536;

const frontmatter = (file) => {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  // A folded (`>`) or literal (`|`) value continues on the indented lines below its key.
  const field = (key) => {
    const lines = match[1].split("\n");
    const start = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (start === -1) return "";
    const inline = lines[start].slice(key.length + 1).trim();
    if (!/^[>|][+-]?$/.test(inline)) return inline.replace(/^["']|["']$/g, "").trim();
    const continuation = [];
    for (const line of lines.slice(start + 1)) {
      if (line.trim() !== "" && !/^\s/.test(line)) break;
      continuation.push(line.trim());
    }
    return continuation.join(" ").trim();
  };
  return { name: field("name"), description: field("description"), whenToUse: field("when_to_use"),
    manual: /^disable-model-invocation:\s*true/m.test(match[1]) };
};

const skillFiles = (dir) => {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (existsSync(join(full, "SKILL.md"))) found.push({ source: dir, file: join(full, "SKILL.md") });
    else found.push(...skillFiles(full));
  }
  return found;
};

// User skills (the kit, vendored, synced) plus skills of enabled plugins in the local cache.
const sources = [...skillFiles(join(CONFIG, "skills")), ...skillFiles(join(CONFIG, "plugins", "synced"))];
const enabled = Object.entries(settings.enabledPlugins || {}).filter(([, on]) => on).map(([id]) => id.split("@")[0]);
const cache = join(CONFIG, "plugins", "cache");
if (existsSync(cache)) for (const market of readdirSync(cache)) for (const plugin of readdirSync(join(cache, market)))
  if (enabled.includes(plugin)) {
    const versions = readdirSync(join(cache, market, plugin)).map((v) => join(cache, market, plugin, v));
    const latest = versions.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    if (latest) sources.push(...skillFiles(latest));
  }

const seen = new Set();
const rows = [];
for (const { file } of sources) {
  const fm = frontmatter(file);
  if (!fm || fm.manual || seen.has(fm.name)) continue;
  seen.add(fm.name);
  rows.push({ name: fm.name, chars: fm.name.length + Math.min(fm.description.length + fm.whenToUse.length, PER_SKILL_CAP) });
}
const totalChars = rows.reduce((sum, r) => sum + r.chars, 0);
const budgetChars = Math.round(contextTokens * fraction * 4);
const report = { skills: rows.length, totalChars, approxTokens: Math.round(totalChars / 4), fraction, contextTokens, budgetChars,
  fits: totalChars <= budgetChars };

if (args.includes("--json")) console.log(JSON.stringify({ ...report, rows }, null, 2));
else console.log(`${report.fits ? "✔" : "✖"}  ${report.skills} model-invocable skills, ${totalChars} chars (~${report.approxTokens} tokens) against a budget of ${budgetChars} chars (${fraction * 100}% of ${contextTokens} tokens). /skill-doctor is the authority.`);
process.exit(report.fits ? 0 : 1);
