import { createResponseObject } from "../../../../commons/systems/responseObjectSystem/utils";
import { ResponseObjectType } from "../../../../commons/systems/responseObjectSystem/types";

import { API_AddNoteType } from "../../../../api/queries/notes/create/endpointTypes";

export const ADD_NOTE_FEATURE_DEFAULT_VALUES: API_AddNoteType = {
  title: "",
  body: ""
};

export const ADD_NOTE_FEATURE_MAX_TITLE_LENGTH = 80;
export const ADD_NOTE_FEATURE_MAX_BODY_LENGTH = 400;

// Module-level singleton: the trigger is never blocked, and a fresh object per validation run
// would be a new identity for every consumer of the validation map.
export const ADD_NOTE_FEATURE_ACTION_TRIGGER_RESPONSE_OBJ: ResponseObjectType =
  createResponseObject({ status: true, msg: "" });
