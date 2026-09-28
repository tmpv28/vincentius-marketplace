import { describe, it, expect } from "vitest";

import { areEqual, areEqualInOrder, areNotEqual } from "./equalityChecks";

const makeCyclicNode = (label: string) => {
  const node: Record<string, any> = { label };
  node.self = node;
  return node;
};

describe("areEqual", () => {
  it("returns true for identical primitives", () => {
    expect(areEqual("note", "note")).toBe(true);
    expect(areEqual(0, 0)).toBe(true);
  });

  it("returns false when a primitive differs", () => {
    expect(areEqual("note", "notes")).toBe(false);
  });

  it("treats every flavour of empty as equal", () => {
    expect(areEqual(null, undefined)).toBe(true);
    expect(areEqual("", null)).toBe(true);
    expect(areEqual([], {})).toBe(true);
  });

  it("does not treat 0 or false as empty", () => {
    expect(areEqual(0, null)).toBe(false);
    expect(areEqual(false, null)).toBe(false);
  });

  it("ignores key order in objects", () => {
    expect(areEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("ignores element order in arrays", () => {
    expect(areEqual([{ id: "1" }, { id: "2" }], [{ id: "2" }, { id: "1" }])).toBe(true);
  });

  it("returns false when an array has a different number of duplicate entries", () => {
    expect(areEqual(["a", "a", "b"], ["a", "b", "b"])).toBe(false);
  });

  it("normalizes dates and ISO strings to the second", () => {
    expect(areEqual("2026-01-01T10:00:05.123Z", "2026-01-01T10:00:05.900Z")).toBe(true);
    expect(areEqual("2026-01-01T10:00:05.000Z", "2026-01-01T10:00:59.000Z")).toBe(false);
  });

  it("terminates on two distinct cyclic graphs instead of overflowing the stack", () => {
    expect(areEqual(makeCyclicNode("a"), makeCyclicNode("a"))).toBe(true);
    expect(areEqual(makeCyclicNode("a"), makeCyclicNode("b"))).toBe(false);
  });

  it("terminates when the cycle is reached through an array", () => {
    expect(areEqual([makeCyclicNode("a")], [makeCyclicNode("a")])).toBe(true);
  });
});

describe("areNotEqual", () => {
  it("inverts areEqual", () => {
    expect(areNotEqual({ a: 1 }, { a: 2 })).toBe(true);
    expect(areNotEqual({ a: 1 }, { a: 1 })).toBe(false);
  });
});

describe("areEqualInOrder", () => {
  it("returns false when array entries are reordered", () => {
    expect(areEqualInOrder([{ id: "1" }, { id: "2" }], [{ id: "2" }, { id: "1" }])).toBe(false);
  });

  it("returns true when array entries match position for position", () => {
    expect(areEqualInOrder([{ id: "1" }, { id: "2" }], [{ id: "1" }, { id: "2" }])).toBe(true);
  });

  it("still ignores key order inside each entry", () => {
    expect(areEqualInOrder([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])).toBe(true);
  });

  it("does not call two different Sets equal just because neither has own keys", () => {
    expect(areEqualInOrder(new Set([1]), new Set([2]))).toBe(false);
  });

  it("does not call two different Maps equal", () => {
    expect(areEqualInOrder(new Map([["a", 1]]), new Map([["b", 2]]))).toBe(false);
  });

  // A timeout, so a regression to unbounded recursion fails this test instead of the suite.
  it("terminates on two distinct cyclic graphs instead of overflowing the stack", () => {
    expect(areEqualInOrder(makeCyclicNode("a"), makeCyclicNode("a"))).toBe(true);
    expect(areEqualInOrder(makeCyclicNode("a"), makeCyclicNode("b"))).toBe(false);
  }, 2000);

  it("terminates on cyclic entries and still compares their arrays position for position", () => {
    const inOrderA = [makeCyclicNode("a"), makeCyclicNode("b")];
    const inOrderB = [makeCyclicNode("a"), makeCyclicNode("b")];
    const reordered = [makeCyclicNode("b"), makeCyclicNode("a")];
    expect(areEqualInOrder(inOrderA, inOrderB)).toBe(true);
    expect(areEqualInOrder(inOrderA, reordered)).toBe(false);
  }, 2000);
});

describe("areEqual with non-plain objects", () => {
  it("does not call two different Sets equal just because neither has own keys", () => {
    expect(areEqual(new Set([1, 2, 3]), new Set())).toBe(false);
  });

  it("does not call two different Errors equal", () => {
    expect(areEqual(new Error("a"), new Error("b"))).toBe(false);
  });

  it("does not call two different RegExps equal", () => {
    expect(areEqual(/abc/, /xyz/)).toBe(false);
  });

  it("normalizes dates inside array entries, not just at the top level", () => {
    expect(areEqual([{ d: "2026-01-01T09:30:10.100Z" }], [{ d: "2026-01-01T09:30:10.900Z" }])).toBe(
      true
    );
  });
});
