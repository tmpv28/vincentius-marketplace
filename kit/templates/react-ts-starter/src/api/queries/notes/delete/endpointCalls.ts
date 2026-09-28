import { useCallback, useMemo } from "react";

import { useToastActionsContext } from "../../../../commons/contexts/Toast/modules/ToastContext.context";

import { interpolateEndpointUrl, treatEntityNameForApiCall } from "../../../configs/modules/utils";
import useDeleteController from "../../../configs/controllers/CRUD/useDeleteController";

import { NOTES_API_URL } from "../endpointsDefinition";
import { API_NoteType } from "../entityTypes";

export const useDeleteNote = () => {
  const { deleteInstance, isLoading } = useDeleteController();
  const { createSuccessfulToast } = useToastActionsContext();

  //-----------

  // No response guard: a delete's body is not read, so there is no shape to claim. The id is
  // required by the URL, and DeleteNoteFeature's validation blocks the call before it gets here.
  const API_DeleteNote = useCallback(
    async (noteDetails: API_NoteType) => {
      const entityName = treatEntityNameForApiCall({
        defaultEntityName: "note",
        entityNameOptions: { name: noteDetails.title }
      });

      return deleteInstance({
        entityName,
        configs: {
          url: interpolateEndpointUrl({
            url: NOTES_API_URL.delete,
            params: { id: noteDetails.id }
          }),
          method: "DELETE"
        },
        onSuccessHandler: {
          action: () => createSuccessfulToast(`${entityName} deleted successfully.`)
        }
      });
    },
    [deleteInstance, createSuccessfulToast]
  );

  //-----------

  return useMemo(() => ({ API_DeleteNote, isLoading }), [API_DeleteNote, isLoading]);
};
