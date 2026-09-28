import { isUndefined } from "../../../../commons/utils/typeChecks/isSpecificType";

// Strips only nullish values and the empty string, so the BE never has to distinguish
// "not sent" from "sent blank".
//
// Deliberately NOT isNullOrEmpty: that treats [], {} and "   " as empty too, which would make
// "clear the tag list" unsendable and would silently drop a File, a Blob or a FormData value,
// none of which have own enumerable keys.
// Partial<T>, because a stripped key is absent and the type has to say so.
export const removeEmptyPayloadProperties = <T extends Record<string, any>>(
  payload: T
): Partial<T> =>
  Object.entries(payload).reduce<Partial<T>>((cleanedPayload, [key, value]) => {
    if (value === null || isUndefined(value) || value === "") return cleanedPayload;
    return { ...cleanedPayload, [key]: value };
  }, {});
