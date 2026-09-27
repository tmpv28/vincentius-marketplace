import { isUndefined } from "../../../../commons/utils/typeChecks/isSpecificType";

// Strips only nullish values and the empty string, so the BE never has to distinguish
// "not sent" from "sent blank".
//
// Deliberately NOT isNullOrEmpty: that treats [], {} and "   " as empty too, which would make
// "clear the tag list" unsendable and would silently drop a File, a Blob or a FormData value,
// none of which have own enumerable keys.
export const removeEmptyPayloadProperties = <T extends Record<string, any>>(payload: T): T =>
  Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (value === null || isUndefined(value) || value === "") return accumulator;
    return { ...accumulator, [key]: value };
  }, {} as T);
