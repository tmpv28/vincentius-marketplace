import { isNullOrEmpty } from "./isNullOrEmpty";
import { isArray, isObject, isPlainObject } from "./isSpecificType";

// Two distinct object graphs that both contain cycles would recurse forever, and a re-fetch
// comparison is exactly the case where the two graphs are distinct. Every pair already being
// compared is remembered, and meeting it again counts as equal: if the rest of the walk finds a
// real difference it still reports one.
type SeenPairsType = WeakMap<object, WeakSet<object>>;

const hasSeenPair = (seenPairs: SeenPairsType, valueA: object, valueB: object): boolean =>
  seenPairs.get(valueA)?.has(valueB) === true;

const rememberPair = (seenPairs: SeenPairsType, valueA: object, valueB: object) => {
  const partners = seenPairs.get(valueA) ?? new WeakSet<object>();
  partners.add(valueB);
  seenPairs.set(valueA, partners);
};

// Dates and ISO strings are normalized to the second. A payload that only differs in
// milliseconds is the same payload; anything coarser would call 10:00:05 and 10:00:59 equal.
const normalizeDates = (value: any) => {
  let parsedDate: Date | null;
  if (value instanceof Date) parsedDate = new Date(value.getTime());
  else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))
    parsedDate = new Date(value);
  else parsedDate = null;

  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    parsedDate.setMilliseconds(0);
    return parsedDate.toISOString();
  }

  return value;
};

function areEqualWithSeenPairs(valueA: any, valueB: any, seenPairs: SeenPairsType): boolean {
  const normalizedA = normalizeDates(valueA);
  const normalizedB = normalizeDates(valueB);

  // 1. Strict equality covers primitives and identical references.
  if (normalizedA === normalizedB) return true;

  // 2. Two empty-ish values are equal regardless of which flavour of empty they are.
  if (isNullOrEmpty(normalizedA) && isNullOrEmpty(normalizedB)) return true;

  // 3. Anything not a container cannot be deeply equal past this point.
  if (!isObject(normalizedA) && !isArray(normalizedA)) return false;
  if (!isObject(normalizedB) && !isArray(normalizedB)) return false;

  if (hasSeenPair(seenPairs, normalizedA, normalizedB)) return true;
  rememberPair(seenPairs, normalizedA, normalizedB);

  // 4. Arrays compare order-agnostically, as a multiset, and each pairing recurses through this
  // same function. Serializing the entries instead would skip date normalization and would call
  // two different Sets or Errors equal.
  if (isArray(normalizedA) && isArray(normalizedB)) {
    if (normalizedA.length !== normalizedB.length) return false;

    const unmatchedEntries = [...normalizedB];
    return normalizedA.every((entryA) => {
      const matchIndex = unmatchedEntries.findIndex((entryB) =>
        areEqualWithSeenPairs(entryA, entryB, seenPairs)
      );
      if (matchIndex === -1) return false;
      unmatchedEntries.splice(matchIndex, 1);
      return true;
    });
  }

  // 5. Anything that is not a plain object carries state Object.keys cannot see, so it is only
  // equal to itself, which step 1 already settled.
  if (!isPlainObject(normalizedA) || !isPlainObject(normalizedB)) return false;

  // 6. Plain objects compare key by key, recursively.
  if (isObject(normalizedA) && isObject(normalizedB)) {
    const objectA: Record<string, any> = normalizedA;
    const objectB: Record<string, any> = normalizedB;

    const keysA = Object.keys(objectA);
    const keysB = Object.keys(objectB);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(
      (key) => keysB.includes(key) && areEqualWithSeenPairs(objectA[key], objectB[key], seenPairs)
    );
  }

  return false;
}

/**
 * Recursively compares two values for deep, order-agnostic equality.
 * - Ignores the order of keys in objects.
 * - Ignores the order of elements in arrays. Use areEqualInOrder when position is meaningful.
 * - Normalizes Dates and ISO strings to the second.
 * - Treats every flavour of empty as equal, so it must not guard a write that swaps one empty
 *   value for another (null to "", [] to {}).
 * - Terminates on cyclic graphs.
 */
export function areEqual(valueA: any, valueB: any): boolean {
  return areEqualWithSeenPairs(valueA, valueB, new WeakMap<object, WeakSet<object>>());
}

export function areNotEqual(valueA: any, valueB: any): boolean {
  return !areEqual(valueA, valueB);
}

/**
 * Same comparison, except arrays must match position for position. Use this to guard a write
 * to anything the user can reorder, where a move IS the change.
 */
export function areEqualInOrder(valueA: any, valueB: any): boolean {
  if (isArray(valueA) && isArray(valueB)) {
    if (valueA.length !== valueB.length) return false;
    return valueA.every((entry, index) => areEqualInOrder(entry, valueB[index]));
  }

  if (isObject(valueA) && isObject(valueB)) {
    const objectA: Record<string, any> = valueA;
    const objectB: Record<string, any> = valueB;

    const keysA = Object.keys(objectA);
    const keysB = Object.keys(objectB);
    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => keysB.includes(key) && areEqualInOrder(objectA[key], objectB[key]));
  }

  return areEqual(valueA, valueB);
}
