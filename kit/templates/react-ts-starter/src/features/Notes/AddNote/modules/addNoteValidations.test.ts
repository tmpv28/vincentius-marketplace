import { describe, expect, it } from "vitest";

import { API_AddNoteType } from "../../../../api/queries/notes/create/endpointTypes";

import {
  ADD_NOTE_FEATURE_MAX_TITLE_LENGTH as maxTitleLength,
  ADD_NOTE_FEATURE_MAX_BODY_LENGTH as maxBodyLength
} from "./constants";
import { validateAddNoteFields } from "./addNoteValidations";

const baseNoteData: API_AddNoteType = { title: "A usable title", body: "A usable body." };

const validate = (overrides: Partial<API_AddNoteType> = {}) =>
  validateAddNoteFields({ ...baseNoteData, ...overrides });

describe("validateAddNoteFields", () => {
  it("allows saving when the title is present and both fields are within their limits", () => {
    expect(validate().saveChanges.status).toBe(true);
  });

  it("blocks saving when the title is missing", () => {
    expect(validate({ title: "" }).saveChanges.status).toBe(false);
  });

  it("blocks saving when the title is only whitespace (blank is not a value)", () => {
    expect(validate({ title: "   " }).saveChanges.status).toBe(false);
  });

  it("explains the block through the same response object the button is disabled by", () => {
    expect(validate({ title: "" }).saveChanges.msg).toBe("Note title is mandatory.");
  });

  it("blocks saving when the title is longer than the allowed length", () => {
    const result = validate({ title: "t".repeat(maxTitleLength + 1) });
    expect(result.saveChanges.status).toBe(false);
    expect(result.saveChanges.msg).toContain(String(maxTitleLength));
  });

  it("allows a title sitting exactly on the allowed length (boundary is inclusive)", () => {
    expect(validate({ title: "t".repeat(maxTitleLength) }).saveChanges.status).toBe(true);
  });

  it("blocks saving when the body is longer than the allowed length", () => {
    expect(validate({ body: "b".repeat(maxBodyLength + 1) }).saveChanges.status).toBe(false);
  });

  it("allows an empty body, because only the title is mandatory", () => {
    expect(validate({ body: "" }).saveChanges.status).toBe(true);
  });

  it("never blocks the action trigger, whatever the field values are", () => {
    expect(validate({ title: "" }).actionTrigger.status).toBe(true);
  });
});
