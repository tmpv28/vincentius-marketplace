import { useCallback, useMemo } from "react";

import { useToastActionsContext } from "../../../../commons/contexts/Toast/modules/ToastContext.context";
import { createResponseObject } from "../../../../commons/systems/responseObjectSystem/utils";
import { ResponseDataContaining } from "../../../../commons/systems/responseObjectSystem/types";
import { isObject, isString } from "../../../../commons/utils/typeChecks/isSpecificType";

import {
  getRequiredFieldUndefinedErrorMsg,
  treatEntityNameForApiCall
} from "../../../configs/modules/utils";
import { removeEmptyPayloadProperties } from "../../../configs/modules/handlers/payloadDataHandlers";
import useCreateController from "../../../configs/controllers/CRUD/useCreateController";

import { validateRequiredPayloadDataForAddNote } from "./validateRequiredPayloadData";
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
        // Checks the two fields the caller actually reads back. A guard that only proves the
        // server sent something would be claiming API_NoteType while verifying nothing.
        responseDataTypeGuard: (
          responseData
        ): responseData is ResponseDataContaining<API_NoteType> =>
          isObject(responseData) && isString(responseData.id) && isString(responseData.title),
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
