// One-off migration: splits standard/ into kit/rules/tv/*.md by moving whole sections verbatim,
// and writes docs/coverage.md proving every section landed in exactly one file.
// Deleted together with standard/ once the coverage table is complete (Phase 3).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "standard");
const OUT = join(ROOT, "kit", "rules", "tv");

// ─── Packs ──────────────────────────────────────────────────
const PACKS = {
  core: { paths: null, title: "Core", why: "Loaded in every session." },
  typescript: { paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"], title: "TypeScript", why: "Loaded in full because a TypeScript file was read." },
  react: { paths: ["**/*.tsx", "**/*.jsx"], title: "React", why: "Loaded in full because a React file was read." },
  accessibility: { paths: ["**/*.tsx", "**/*.jsx", "**/*.html", "**/*.htm", "**/*.vue", "**/*.svelte"], title: "Accessibility", why: "Loaded in full because a UI file was read." },
  styles: { paths: ["**/*.scss", "**/*.css"], title: "Styles", why: "Loaded in full because a stylesheet was read." },
  scss: { paths: ["**/*.scss"], title: "SCSS", why: "Loaded in full because an SCSS file was read." },
  testing: { paths: ["**/*.test.*", "**/*.spec.*", "**/vite.config.*", "**/vitest.config.*", "**/vitest.setup.*"], title: "Testing", why: "Loaded in full because a test file or test config was read." },
  "node-tooling": { paths: ["**/package.json", "**/pnpm-workspace.yaml", "**/eslint.config.*", "**/.prettierrc*", "**/.stylelintrc*", "**/.husky/**", "**/tsconfig*.json"], title: "Node tooling", why: "Loaded in full because a Node project's tooling file was read." }
};

// ─── Section map: chapter -> { heading (or "_intro") -> pack | "drop:<reason>" } ──
const MAP = {
  "AGENTS.md": {
    "_intro": "drop:rewritten as the contract header of core.md",
    "Mandatory load": "drop:rewritten in core.md (global scope, core plus packs, read before create)",
    "The non-negotiables": "drop:restates 00, which is in core.md; 00 owns the topic",
    "What to do when you are unsure": "core",
    "What I will notice immediately": "react",
    "Process rules": "core",
    "Dependencies": "drop:restates 11 Dependencies, which is in core.md; 11 owns the topic"
  },
  "README.md": {
    "_intro": "drop:repository description, now in docs/migration.md",
    "Scope and provenance": "drop:moved to docs/migration.md",
    "Who this is for": "drop:superseded by the install docs",
    "How to use it": "drop:superseded by the install docs and tv-new-project",
    "Layout": "drop:superseded by docs/rules.md",
    "The one-paragraph version": "core"
  },
  "identity/who-i-am.md": { "*": "core" },
  "identity/voice.md": { "*": "core" },
  "identity/instincts.md": { "*": "core" },
  "standards/00-non-negotiables.md": { "*": "core" },
  "standards/01-project-anatomy.md": { "*": "react" },
  "standards/02-naming.md": {
    "_intro": "core", "The suffix rules": "react", "Casing": "react", "Booleans": "core", "Handlers": "react",
    "Hooks": "react", "The `API_` prefix": "react", "Constants": "typescript", "Variables": "core", "Length is not a cost": "core"
  },
  "standards/03-typescript.md": { "*": "typescript" },
  "standards/04-react-components.md": { "*": "react", "Accessibility": "accessibility" },
  "standards/05-state-and-contexts.md": { "*": "react" },
  "standards/06-api-layer.md": { "*": "react", "The response object": "typescript", "The type guard": "typescript" },
  "standards/07-styling-scss.md": {
    "_intro": "scss", "The callers pattern": "scss", "Class naming": "styles", "Property order": "styles",
    "Stylelint posture": "scss", "The `//-----------` separator, again": "scss", "Colour": "styles",
    "The action-state classes": "styles", "Mixins": "scss", "What never appears": "styles"
  },
  "standards/08-comments-and-docs.md": { "*": "core", "JSDoc": "typescript", "Trailing comments on dependency arrays": "react" },
  "standards/09-testing.md": { "*": "testing", "Dates": "core", "Test-first, where it earns it": "core", "Before finishing": "core" },
  "standards/10-tooling-and-checks.md": {
    "The check script is the gate": "node-tooling", "The gate is enforced, not remembered": "node-tooling",
    "The interesting part: deduplicate across tools": "core", "Output is designed": "core", "The messages have a voice": "core",
    "Dev server branding": "node-tooling", "Formatting and linting": "node-tooling", "Project-level lint rules": "core",
    "The generators are the real enforcement": "core", "No path aliases": "typescript", "Commands": "node-tooling"
  },
  "standards/11-git-and-delivery.md": { "*": "core" }
};

// ─── Text fixes applied while moving (each one is a drift item) ─
const FIXES = [
  // 04: a code fence closed mid-line and the nested-ternary paragraph had no heading.
  ["standards/04-react-components.md", "---\n\nNested ternaries happen.", "## Nested ternaries\n\nNested ternaries happen."],
  ["standards/04-react-components.md", "``` A nested ternary that reads as a decision table", "```\n\nA nested ternary that reads as a decision table"],
  // 08: Claude Code never loads .claude/memory/; corrections live in auto memory or become rules.
  ["standards/08-comments-and-docs.md", "Things I have corrected more than once go in `.claude/memory/`.",
    "Things I have corrected more than once go in Claude Code's auto memory, as the mistake, **Why**, **How to apply**. A correction every project needs becomes a rule in the pack it belongs to."]
];

// Chapter file names inside the prose become stable labels; docs/rules.md maps each to its packs.
const relabel = (text) => text
  .replace(/`?standards\/(\d{2})-[a-z-]+\.md`?/g, "TV $1")
  .replace(/`?(\d{2})-[a-z-]+\.md`?/g, "TV $1")
  .replace(/`identity\/([a-z-]+)\.md`/g, "identity: $1");

const chapterLabel = (file) => {
  const m = file.match(/standards\/(\d{2})/);
  if (m) return `TV ${m[1]}`;
  if (file.startsWith("identity/")) return `identity: ${file.slice(9, -3)}`;
  return file.replace(".md", "");
};

// ─── Split every chapter into sections ──────────────────────
const sections = [];
for (const file of Object.keys(MAP)) {
  let text = readFileSync(join(SRC, file), "utf8").replace(/\r\n/g, "\n");
  for (const [target, from, to] of FIXES) if (target === file) {
    if (!text.includes(from)) throw new Error(`fix not applicable in ${file}: ${from.slice(0, 40)}`);
    text = text.replace(from, to);
  }
  const lines = text.split("\n");
  const title = lines[0].replace(/^#\s+/, "");
  let current = { heading: "_intro", body: [] };
  const parts = [current];
  let inFence = false;
  for (const line of lines.slice(1)) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^## /.test(line)) {
      current = { heading: line.replace(/^## /, "").trim(), body: [] };
      parts.push(current);
    } else current.body.push(line);
  }
  const rules = MAP[file];
  for (const part of parts) {
    const body = part.body.join("\n").replace(/^\s*---\s*$/gm, "").trim();
    if (part.heading === "_intro" && body === "") continue;
    const target = rules[part.heading] ?? rules["*"];
    if (!target) throw new Error(`unmapped section: ${file} > ${part.heading}`);
    sections.push({ file, title, heading: part.heading, body, target, label: chapterLabel(file) });
  }
  for (const key of Object.keys(rules)) if (key !== "*" && !parts.some((p) => p.heading === key))
    throw new Error(`map names a missing section: ${file} > ${key}`);
}

// ─── Write the packs ────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const CONTRACT = readFileSync(join(ROOT, "scripts", "contract.md"), "utf8").replace(/\r\n/g, "\n").trim();
for (const [name, pack] of Object.entries(PACKS)) {
  const mine = sections.filter((s) => s.target === name);
  const front = pack.paths ? `---\npaths:\n${pack.paths.map((p) => `  - "${p}"`).join("\n")}\n---\n\n` : "";
  const out = [
    `${front}# TV-STANDARD: ${pack.title}`,
    "",
    `TV-PACK: ${name}`,
    "",
    `${pack.why} "TV NN" names the original chapter; docs/rules.md maps each chapter to its packs.`,
    name === "core" ? "\n" + CONTRACT : "Precedence: a pack beats the core where it is more specific. A collision means one side is stale: report it, do not work around it.",
    ""
  ];
  let lastFile = null;
  for (const s of mine) {
    if (s.file !== lastFile) { out.push("---", "", `<!-- from ${s.file} -->`, ""); lastFile = s.file; }
    const heading = s.heading === "_intro" ? s.title.replace(/^\d{2}\s+\S+\s+/, "") : s.heading;
    out.push(`## ${heading} (${s.label})`, "", relabel(s.body), "");
  }
  writeFileSync(join(OUT, `${name}.md`), out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");
}

// ─── Coverage table ─────────────────────────────────────────
const rows = sections.map((s) => `| ${s.file} | ${s.heading === "_intro" ? "(intro)" : s.heading.replace(/\|/g, "\\|")} | ${s.target.startsWith("drop:") ? "not a rule: " + s.target.slice(5) : s.target + ".md"} |`);
const coverage = [
  "# Coverage",
  "",
  "Every section of TV-STANDARD and the file it now lives in. Generated by the Phase 3 migration from",
  "the section map; each section appears exactly once. Sections marked \"not a rule\" moved to the docs",
  "or were restatements of a section that owns the topic.",
  "",
  "| Source | Section | Now in |",
  "| --- | --- | --- |",
  ...rows,
  ""
].join("\n");
writeFileSync(join(ROOT, "docs", "coverage.md"), coverage);

const counts = {};
for (const s of sections) counts[s.target.startsWith("drop:") ? "drop" : s.target] = (counts[s.target.startsWith("drop:") ? "drop" : s.target] || 0) + 1;
console.log("sections:", sections.length, JSON.stringify(counts));
