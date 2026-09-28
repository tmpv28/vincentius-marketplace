import { describe, expect, it } from "vitest";

import { removeEmptyPayloadProperties } from "./payloadDataHandlers";

describe("removeEmptyPayloadProperties", () => {
  it("drops null, undefined and empty-string values (absent, not sent blank)", () => {
    expect(
      removeEmptyPayloadProperties({ title: "Kept", body: "", tag: null, owner: undefined })
    ).toEqual({ title: "Kept" });
  });

  it("removes the key itself, not just its value", () => {
    expect("body" in removeEmptyPayloadProperties({ title: "Kept", body: "" })).toBe(false);
  });

  it("keeps 0 and false, which are values", () => {
    expect(removeEmptyPayloadProperties({ count: 0, isPinned: false })).toEqual({
      count: 0,
      isPinned: false
    });
  });

  it("keeps an empty array and an empty object (clearing a list must stay sendable)", () => {
    expect(removeEmptyPayloadProperties({ tags: [], meta: {} })).toEqual({ tags: [], meta: {} });
  });

  it("keeps a whitespace-only string, which is not the empty string", () => {
    expect(removeEmptyPayloadProperties({ title: "   " })).toEqual({ title: "   " });
  });
});
