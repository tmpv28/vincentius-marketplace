// Status line: model, context used, and the five-hour limit. Runs locally; costs no tokens.
// Every field is optional and may arrive as null or a string, so nothing is assumed about its shape.
const toPercent = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const percent = Number(value);
  return Number.isFinite(percent) ? percent : null;
};

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw) || {}; } catch { process.exit(0); }
  const modelName = [input.model?.display_name, input.model?.id].find((name) => typeof name === "string" && name !== "");
  const context = toPercent(input.context_window?.used_percentage);
  const fiveHour = toPercent(input.rate_limits?.five_hour?.used_percentage);
  const parts = [modelName ?? "Claude"];
  if (context !== null) parts.push(`ctx ${Math.round(context)}%`);
  if (fiveHour !== null) parts.push(`5h ${Math.round(fiveHour)}%`);
  process.stdout.write(parts.join(" · "));
});
