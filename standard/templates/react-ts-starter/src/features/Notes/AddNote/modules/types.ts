import { ResponseObjectType } from "../../../../commons/systems/responseObjectSystem/types";

import { API_AddNoteType } from "../../../../api/queries/notes/create/endpointTypes";
import { API_NoteType } from "../../../../api/queries/notes/entityTypes";

export interface AddNoteFeatureType {
  onNoteAddedHandler?: (addedNote: API_NoteType) => void;
}

// One entry per UI affordance, each a response object, so the block and the reason for the block
// can never drift apart.
export interface AddNoteButtonsValidationType {
  actionTrigger: ResponseObjectType;
  saveChanges: ResponseObjectType;
}

export interface UseAddNoteValidationsType {
  noteData: API_AddNoteType;
}
