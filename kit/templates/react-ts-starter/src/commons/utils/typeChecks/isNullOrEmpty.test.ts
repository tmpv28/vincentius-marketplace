import { describe, expect, it } from "vitest";

import { isNullOrEmpty } from "./isNullOrEmpty";

describe("isNullOrEmpty", () => {
  it("returns true for null", () => {
    expect(isNullOrEmpty(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isNullOrEmpty(undefined)).toBe(true);
  });

  it("returns true for an empty string", () => {
    expect(isNullOrEmpty("")).toBe(true);
  });

  it("returns true for a whitespace-only string", () => {
    expect(isNullOrEmpty("   ")).toBe(true);
  });

  it("returns true for an empty array", () => {
    expect(isNullOrEmpty([])).toBe(true);
  });

  it("returns true for an empty object", () => {
    expect(isNullOrEmpty({})).toBe(true);
  });

  it("returns true for an invalid date", () => {
    expect(isNullOrEmpty(new Date("not a date"))).toBe(true);
  });

  it("returns false for zero (a number is a value, never an absence)", () => {
    expect(isNullOrEmpty(0)).toBe(false);
  });

  it("returns false for a valid date", () => {
    expect(isNullOrEmpty(new Date(Date.UTC(2026, 0, 12, 9, 30)))).toBe(false);
  });

  it("returns false for a non-empty string", () => {
    expect(isNullOrEmpty("note")).toBe(false);
  });

  it("returns false for a populated array", () => {
    expect(isNullOrEmpty([0])).toBe(false);
  });

  it("returns false for an object carrying keys", () => {
    expect(isNullOrEmpty({ title: "" })).toBe(false);
  });
});
