import { useCallback, useMemo } from "react";

import { useToastActionsContext } from "../../../../commons/contexts/Toast/modules/ToastContext.context";
import { createResponseObject } from "../../../../commons/systems/responseObjectSystem/utils";

import {
  getRequiredFieldUndefinedErrorMsg,
  treatEntityNameForApiCall
} from "../../../configs/modules/utils";
import { removeEmptyPayloadProperties } from "../../../configs/modules/handlers/payloadDataHandlers";
import useCreateController from "../../../configs/controllers/CRUD/useCreateController";

import { validateRequiredPayloadDataForAddNote } from "./validateRequiredPayloadData";
import { isApiNoteType } from "../modules/notesGuards";
import { NOTES_API_URL } from "../endpointsDefinition";
import { API_NoteType } from "../entityTypes";
import { API_AddNoteType } from "./endpointTypes";

export const useAddNote = () => {
  const { createInstance, isLoading } = useCreateController();
  const { createSuccessfulToast } = useToastActionsContext();

  //-----------

  const API_AddNote = useCallback(
    async (noteDetails: API_AddNoteType) => {
      const entityName = treatEntityNameForApiCall({
        defaultEntityName: "note",
        entityNameOptions: { name: noteDetails.title }
      });

      const cleanedNoteDetails = removeEmptyPayloadProperties(noteDetails);

      return createInstance<API_NoteType>({
        entityName,
        configs: { url: NOTES_API_URL.create, method: "POST", data: cleanedNoteDetails },
        // The server returns the created entity directly, so the shared entity guard applies at
        // the top level. A guard that only proves the server sent something would be claiming
        // API_NoteType while verifying nothing.
        responseDataTypeGuard: isApiNoteType,
        onSuccessHandler: {
          action: () => createSuccessfulToast(`${entityName} added successfully.`)
        },
        extraValidationsBeforePerformingApiService: () => {
          const validation = validateRequiredPayloadDataForAddNote(cleanedNoteDetails);
          if (!validation.status)
            return createResponseObject({
              msg: getRequiredFieldUndefinedErrorMsg({
                actionType: "add",
                entityName: "note",
                fieldName: validation.statusCodeMsg,
                customReason: validation.msg
              })
            });
          return undefined;
        }
      });
    },
    [createInstance, createSuccessfulToast]
  );

  //-----------

  return useMemo(() => ({ API_AddNote, isLoading }), [API_AddNote, isLoading]);
};
