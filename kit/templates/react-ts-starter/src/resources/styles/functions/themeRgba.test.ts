import { compileString } from "sass";
import { describe, expect, it } from "vitest";

// The test file's own URL makes sass resolve the relative @use from this folder, with no node
// path module (the template ships no Node types).
const compileDeclaration = (call: string) =>
  compileString(`@use "themeRgba" as *;\n.Probe { color: ${call}; }`, {
    url: new URL(import.meta.url),
    style: "compressed"
  }).css;

describe("themeRgba", () => {
  it("wraps a bare custom property in rgb(var()) at full opacity", () => {
    expect(compileDeclaration("themeRgba(--color-accent)")).toBe(
      ".Probe{color:rgb(var(--color-accent))}"
    );
  });

  it("keeps the var() when an alpha is given (a bare rgba(--x, a) is dropped by the browser)", () => {
    expect(compileDeclaration("themeRgba(--color-accent, 0.4)")).toBe(
      ".Probe{color:rgba(var(--color-accent), 0.4)}"
    );
  });

  it("accepts a property already written as var()", () => {
    expect(compileDeclaration("themeRgba(var(--color-accent), 0.4)")).toBe(
      ".Probe{color:rgba(var(--color-accent), 0.4)}"
    );
  });
});
