import { describe, expect, it } from "vitest";

import { interpolateEndpointUrl } from "./utils";

describe("interpolateEndpointUrl", () => {
  it("fills a placeholder with its param", () => {
    expect(interpolateEndpointUrl({ url: "/notes/{id}", params: { id: "Note_1" } })).toBe(
      "/notes/Note_1"
    );
  });

  it("fills every placeholder in the URL", () => {
    expect(
      interpolateEndpointUrl({
        url: "/boards/{boardId}/notes/{noteId}",
        params: { boardId: "b1", noteId: "n2" }
      })
    ).toBe("/boards/b1/notes/n2");
  });

  it("accepts a numeric param, including 0 (a value, not an absence)", () => {
    expect(interpolateEndpointUrl({ url: "/notes/{id}", params: { id: 0 } })).toBe("/notes/0");
  });

  it("encodes the param so it stays one path segment", () => {
    expect(interpolateEndpointUrl({ url: "/notes/{id}", params: { id: "a/b c" } })).toBe(
      "/notes/a%2Fb%20c"
    );
  });

  it("leaves a URL without placeholders unchanged", () => {
    expect(interpolateEndpointUrl({ url: "/notes" })).toBe("/notes");
  });

  it("throws when a placeholder has no param (never sends /notes/{id})", () => {
    expect(() => interpolateEndpointUrl({ url: "/notes/{id}" })).toThrow('"id" is required');
  });

  it("throws when the param is an empty string (never sends /notes/)", () => {
    expect(() => interpolateEndpointUrl({ url: "/notes/{id}", params: { id: "" } })).toThrow(
      '"id" is required'
    );
  });
});
