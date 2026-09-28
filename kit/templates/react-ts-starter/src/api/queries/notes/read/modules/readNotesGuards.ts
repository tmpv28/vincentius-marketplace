import { ResponseDataContaining } from "../../../../../commons/systems/responseObjectSystem/types";
import {
  isArray,
  isObject,
  isString,
  isUndefined
} from "../../../../../commons/utils/typeChecks/isSpecificType";

import { API_NoteType } from "../../entityTypes";

// Every field the entity type claims, so the predicate proves exactly what it names.
export function isApiNoteType(noteData: any): noteData is API_NoteType {
  return (
    isObject(noteData) &&
    isString(noteData.id) &&
    isString(noteData.title) &&
    isString(noteData.createdAt) &&
    (isUndefined(noteData.body) || isString(noteData.body))
  );
}

// The server wraps the collection in a data property, so this checks at that depth and the
// consumer's .then() reads response.data.data.
export function isReadNotesResponseData(
  responseData: any
): responseData is ResponseDataContaining<{ data: API_NoteType[] }> {
  return (
    isObject(responseData) && isArray(responseData.data) && responseData.data.every(isApiNoteType)
  );
}
