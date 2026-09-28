import { useMemo } from "react";

import { createResponseObject } from "../../../../commons/systems/responseObjectSystem/utils";
import { isNullOrEmpty } from "../../../../commons/utils/typeChecks/isNullOrEmpty";

import { API_AddNoteType } from "../../../../api/queries/notes/create/endpointTypes";

import {
  ADD_NOTE_FEATURE_ACTION_TRIGGER_RESPONSE_OBJ as actionTriggerResponseObj,
  ADD_NOTE_FEATURE_MAX_TITLE_LENGTH as maxTitleLength,
  ADD_NOTE_FEATURE_MAX_BODY_LENGTH as maxBodyLength
} from "./constants";
import { AddNoteButtonsValidationType, UseAddNoteValidationsType } from "./types";

// Pure, and outside the hook, so the rules can be tested without rendering anything.
export const validateAddNoteFields = (noteData: API_AddNoteType): AddNoteButtonsValidationType => {
  if (isNullOrEmpty(noteData.title))
    return {
      actionTrigger: actionTriggerResponseObj,
      saveChanges: createResponseObject({ msg: "Note title is mandatory." })
    };

  if (noteData.title.length > maxTitleLength)
    return {
      actionTrigger: actionTriggerResponseObj,
      saveChanges: createResponseObject({
        msg: `Note title must be at most ${maxTitleLength} characters.`
      })
    };

  if (!isNullOrEmpty(noteData.body) && noteData.body.length > maxBodyLength)
    return {
      actionTrigger: actionTriggerResponseObj,
      saveChanges: createResponseObject({
        msg: `Note body must be at most ${maxBodyLength} characters.`
      })
    };

  return {
    actionTrigger: actionTriggerResponseObj,
    saveChanges: createResponseObject({ status: true, msg: "" })
  };
};

const useAddNoteValidations = ({ noteData }: UseAddNoteValidationsType) => {
  const addNoteButtonsValidationResponseObj = useMemo(
    () => validateAddNoteFields(noteData),
    [noteData]
  );

  return useMemo(
    () => ({ addNoteButtonsValidationResponseObj }),
    [addNoteButtonsValidationResponseObj]
  );
};

export default useAddNoteValidations;
