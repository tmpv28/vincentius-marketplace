import { OnClickType } from "../types/generic";

// Frozen, shared sentinels. A new [] or {} on every render is an identity change, and an
// identity change is a re-render. These exist so a default value never causes one.
export const EMPTY_ARRAY: never[] = [];
export const EMPTY_OBJ: Record<string, never> = {};
export const emptyOnClick: OnClickType = () => {};
