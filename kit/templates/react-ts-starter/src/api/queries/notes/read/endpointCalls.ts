import { useCallback, useMemo } from "react";

import { ResponseDataContaining } from "../../../../commons/systems/responseObjectSystem/types";

import useReadController from "../../../configs/controllers/CRUD/useReadController";
import { DefaultEndpointHandlingType } from "../../../configs/modules/sharedTypes";

import { NOTES_API_URL } from "../endpointsDefinition";
import { API_NoteType } from "../entityTypes";

import { isReadNotesResponseData } from "./modules/readNotesGuards";

export const useReadNotes = ({ entityName = "notes" }: DefaultEndpointHandlingType = {}) => {
  const { readInstance, isLoading } = useReadController();

  //-----------

  // The guard's depth has to match what the .then() reads: the server wraps the collection in
  // a data property, so the consumer reads response.data.data.
  const API_ReadNotes = useCallback(
    async () =>
      readInstance<ResponseDataContaining<{ data: API_NoteType[] }>>({
        entityName,
        configs: { url: NOTES_API_URL.list, method: "GET" },
        responseDataTypeGuard: isReadNotesResponseData
      }),
    [readInstance, entityName]
  );

  //-----------

  return useMemo(() => ({ API_ReadNotes, isLoading }), [API_ReadNotes, isLoading]);
};
