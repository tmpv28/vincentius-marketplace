import { describe, expect, it } from "vitest";

import { API_NoteType } from "../../entityTypes";

import { isReadNotesResponseData } from "./readNotesGuards";

const baseNote: API_NoteType = {
  id: "Note_1",
  title: "A usable title",
  body: "A usable body.",
  createdAt: "2026-01-15T09:30:00.000Z"
};

describe("isReadNotesResponseData", () => {
  it("accepts a wrapped collection of valid notes", () => {
    expect(isReadNotesResponseData({ data: [baseNote] })).toBe(true);
  });

  it("accepts a wrapped empty collection", () => {
    expect(isReadNotesResponseData({ data: [] })).toBe(true);
  });

  it("rejects an unwrapped array (guard depth must match what .then() reads)", () => {
    expect(isReadNotesResponseData([baseNote])).toBe(false);
  });

  it("rejects a collection holding one malformed note", () => {
    expect(isReadNotesResponseData({ data: [baseNote, { ...baseNote, title: null }] })).toBe(false);
  });

  it("rejects a missing payload", () => {
    expect(isReadNotesResponseData(undefined)).toBe(false);
  });
});
