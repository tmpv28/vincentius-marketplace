// Status line: model, context used, and the five-hour limit. Runs locally; costs no tokens.
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const model = input.model?.display_name || input.model?.id || "Claude";
  const context = input.context_window?.used_percentage;
  const fiveHour = input.rate_limits?.five_hour?.used_percentage;
  const parts = [model];
  if (typeof context === "number") parts.push(`ctx ${Math.round(context)}%`);
  if (typeof fiveHour === "number") parts.push(`5h ${Math.round(fiveHour)}%`);
  process.stdout.write(parts.join(" · "));
});
