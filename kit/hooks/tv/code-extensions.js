// The files whose text is code-adjacent under TV 00 #5. One list, shared by em-dash-notice.js and
// scripts/std-check.mjs, so the notice and the gate never disagree about what counts as code.
// ipynb is here because NotebookEdit writes code cells; md is not, because long-form prose may use em-dashes.
const CODE_ADJACENT_EXTENSIONS = [
  "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "ipynb",
  "vue", "svelte", "astro", "html", "htm", "css", "scss", "yml", "yaml",
  "c", "h", "cc", "cpp", "cxx", "hh", "hpp", "py", "cs", "go", "rs", "java", "swift", "kt", "rb", "php",
  "sh", "ps1"
];

const CODE_ADJACENT_FILE = new RegExp(`\\.(${CODE_ADJACENT_EXTENSIONS.join("|")})$`, "i");

// By code point, because an editor can turn an escape back into the character TV 00 #5 bans.
const EM_DASH = String.fromCharCode(0x2014);

module.exports = { CODE_ADJACENT_FILE, EM_DASH };
