import { OnClickType } from "../types/generic";

// Shared sentinels, immutable by convention: never mutate them. A new [] or {} on every render is
// an identity change, and an identity change is a re-render. These exist so a default value never
// causes one. Not Object.freeze'd: a frozen array is readonly never[], which useState<T[]> rejects.
export const EMPTY_ARRAY: never[] = [];
export const EMPTY_OBJ: Record<string, never> = {};
export const emptyOnClick: OnClickType = () => {};
