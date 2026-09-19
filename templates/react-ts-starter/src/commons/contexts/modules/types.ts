// Re-exported here so every provider imports its children shape from the contexts vocabulary
// rather than reaching into the generic type bag.
export type { GenericProviderType } from "../../types/generic";

// Brand carried only by a context's default value, never by a provider's value. Without it the
// "used outside its Provider" guard is dead code: a real default object is truthy, so a missing
// provider silently hands every consumer no-op actions and an empty state instead of throwing.
export interface DefaultContextValueBrandType {
  readonly isDefaultContextValue?: true;
}
