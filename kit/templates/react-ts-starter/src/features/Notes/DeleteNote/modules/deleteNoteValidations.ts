import { useMemo } from "react";

import { createResponseObject } from "../../../../commons/systems/responseObjectSystem/utils";
import { isNullOrEmpty } from "../../../../commons/utils/typeChecks/isNullOrEmpty";

import { API_NoteType } from "../../../../api/queries/notes/entityTypes";

import { DeleteNoteButtonsValidationType, UseDeleteNoteValidationsType } from "./types";

// Pure, and outside the hook, so the rules can be tested without rendering anything.
export const validateDeleteNoteFields = (
  noteData: API_NoteType
): DeleteNoteButtonsValidationType => {
  if (isNullOrEmpty(noteData.id))
    return { deleteNote: createResponseObject({ msg: "This note has no id to delete by." }) };

  return { deleteNote: createResponseObject({ status: true, msg: `Delete "${noteData.title}"` }) };
};

const useDeleteNoteValidations = ({ noteData }: UseDeleteNoteValidationsType) => {
  const deleteNoteButtonsValidationResponseObj = useMemo(
    () => validateDeleteNoteFields(noteData),
    [noteData]
  );

  return useMemo(
    () => ({ deleteNoteButtonsValidationResponseObj }),
    [deleteNoteButtonsValidationResponseObj]
  );
};

export default useDeleteNoteValidations;
