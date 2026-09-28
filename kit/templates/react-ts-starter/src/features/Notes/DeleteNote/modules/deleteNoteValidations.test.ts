import { describe, expect, it } from "vitest";

import { API_NoteType } from "../../../../api/queries/notes/entityTypes";

import { validateDeleteNoteFields } from "./deleteNoteValidations";

const baseNoteData: API_NoteType = {
  id: "Note_1",
  title: "A usable title",
  createdAt: new Date(Date.UTC(2026, 0, 15, 9, 30)).toISOString()
};

const validate = (overrides: Partial<API_NoteType> = {}) =>
  validateDeleteNoteFields({ ...baseNoteData, ...overrides });

describe("validateDeleteNoteFields", () => {
  it("allows deleting a note that has an id", () => {
    expect(validate().deleteNote.status).toBe(true);
  });

  it("names the note being deleted in the message the button shows", () => {
    expect(validate().deleteNote.msg).toBe('Delete "A usable title"');
  });

  it("blocks deleting when the id is missing (nothing to delete by)", () => {
    expect(validate({ id: "" }).deleteNote.status).toBe(false);
  });

  it("explains the block through the same response object the button is disabled by", () => {
    expect(validate({ id: "  " }).deleteNote.msg).toBe("This note has no id to delete by.");
  });
});
