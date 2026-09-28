import { ResponseDataContaining } from "../../../../../commons/systems/responseObjectSystem/types";
import { isArray, isObject } from "../../../../../commons/utils/typeChecks/isSpecificType";

import { isApiNoteType } from "../../modules/notesGuards";
import { API_NoteType } from "../../entityTypes";

// The server wraps the collection in a data property, so this checks at that depth and the
// consumer's .then() reads response.data.data.
export function isReadNotesResponseData(
  responseData: any
): responseData is ResponseDataContaining<{ data: API_NoteType[] }> {
  return (
    isObject(responseData) && isArray(responseData.data) && responseData.data.every(isApiNoteType)
  );
}
