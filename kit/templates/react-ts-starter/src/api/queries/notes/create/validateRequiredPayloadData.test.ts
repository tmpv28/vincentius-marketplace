import { describe, expect, it } from "vitest";

import { API_AddNoteType } from "./endpointTypes";
import { validateRequiredPayloadDataForAddNote } from "./validateRequiredPayloadData";

const baseNoteDetails: API_AddNoteType = { title: "A usable title", body: "A usable body." };

const validate = (overrides: Partial<API_AddNoteType> = {}) =>
  validateRequiredPayloadDataForAddNote({ ...baseNoteDetails, ...overrides });

describe("validateRequiredPayloadDataForAddNote", () => {
  it("passes a payload that carries a title", () => {
    expect(validate().status).toBe(true);
  });

  it("passes a payload without a body (only the title is required)", () => {
    expect(validate({ body: undefined }).status).toBe(true);
  });

  it("fails a payload whose title is missing", () => {
    expect(validateRequiredPayloadDataForAddNote({ body: "Only a body." }).status).toBe(false);
  });

  it("fails a payload whose title is only whitespace (blank is not a value)", () => {
    expect(validate({ title: "   " }).status).toBe(false);
  });

  it("names the failing field in statusCodeMsg, for the message builder upstream", () => {
    expect(validate({ title: "" }).statusCodeMsg).toBe("title");
  });
});
