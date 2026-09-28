import {
  isObject,
  isString,
  isUndefined
} from "../../../../commons/utils/typeChecks/isSpecificType";

import { API_NoteType } from "../entityTypes";

// Every field the entity type claims, so the predicate proves exactly what it names. Beside the
// verb folders, like the type it checks, so create/ and read/ share it without a sibling import.
export function isApiNoteType(noteData: any): noteData is API_NoteType {
  return (
    isObject(noteData) &&
    isString(noteData.id) &&
    isString(noteData.title) &&
    isString(noteData.createdAt) &&
    (isUndefined(noteData.body) || isString(noteData.body))
  );
}
