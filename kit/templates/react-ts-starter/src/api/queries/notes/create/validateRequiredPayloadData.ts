import { createResponseObject } from "../../../../commons/systems/responseObjectSystem/utils";
import { ResponseObjectType } from "../../../../commons/systems/responseObjectSystem/types";
import { isNullOrEmpty } from "../../../../commons/utils/typeChecks/isNullOrEmpty";

import { API_AddNoteType } from "./endpointTypes";

// statusCodeMsg carries the field name that failed, so the message builder upstream can name it
// without this validator needing to know how messages are phrased.
export const validateRequiredPayloadDataForAddNote = (
  noteDetails: Partial<API_AddNoteType>
): ResponseObjectType => {
  if (isNullOrEmpty(noteDetails.title))
    return createResponseObject({ statusCodeMsg: "title", msg: "a title is required." });

  return createResponseObject({ status: true, statusCodeMsg: "", msg: "" });
};
