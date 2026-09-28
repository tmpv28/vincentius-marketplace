import { ResponseObjectType } from "../../../../commons/systems/responseObjectSystem/types";

import { API_NoteType } from "../../../../api/queries/notes/entityTypes";

export interface DeleteNoteFeatureType {
  noteData: API_NoteType;

  onNoteDeletedHandler?: (deletedNote: API_NoteType) => void;
}

// One entry per UI affordance, each a response object, so the block and the reason for the block
// can never drift apart.
export interface DeleteNoteButtonsValidationType {
  deleteNote: ResponseObjectType;
}

export interface UseDeleteNoteValidationsType {
  noteData: API_NoteType;
}
