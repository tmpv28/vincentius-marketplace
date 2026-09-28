import { describe, expect, it } from "vitest";

import { API_NoteType } from "../entityTypes";

import { isApiNoteType } from "./notesGuards";

const baseNote: API_NoteType = {
  id: "Note_1",
  title: "A usable title",
  body: "A usable body.",
  createdAt: "2026-01-15T09:30:00.000Z"
};

const makeNote = (overrides: Record<string, unknown> = {}) => ({ ...baseNote, ...overrides });

describe("isApiNoteType", () => {
  it("accepts a note carrying every field the type claims", () => {
    expect(isApiNoteType(baseNote)).toBe(true);
  });

  it("accepts a note without a body (body is optional on the entity)", () => {
    expect(isApiNoteType(makeNote({ body: undefined }))).toBe(true);
  });

  it("rejects a note whose id is not a string", () => {
    expect(isApiNoteType(makeNote({ id: 42 }))).toBe(false);
  });

  it("rejects a note missing its title", () => {
    expect(isApiNoteType(makeNote({ title: undefined }))).toBe(false);
  });

  it("rejects a note missing its creation date", () => {
    expect(isApiNoteType(makeNote({ createdAt: undefined }))).toBe(false);
  });

  it("rejects a body that is present but not a string", () => {
    expect(isApiNoteType(makeNote({ body: 7 }))).toBe(false);
  });

  it("rejects a payload that is not an object", () => {
    expect(isApiNoteType("Note_1")).toBe(false);
  });
});
