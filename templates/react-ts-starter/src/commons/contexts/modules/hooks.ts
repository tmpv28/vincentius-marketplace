import { Context, useContext } from "react";

import { DefaultContextValueBrandType } from "./types";

// The accessor exists so "used outside its Provider" is a loud error at the point of misuse,
// instead of no-op actions that fail silently three renders later somewhere unrelated.
export function useCustomContext<T extends DefaultContextValueBrandType>(context: Context<T>): T {
  const usingContext = useContext(context);
  if (usingContext.isDefaultContextValue)
    throw new Error("A context hook was used outside its Provider.");
  return usingContext;
}
