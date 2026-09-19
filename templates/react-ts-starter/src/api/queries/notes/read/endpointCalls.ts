import { useCallback, useMemo } from "react";

import { ResponseDataContaining } from "../../../../commons/systems/responseObjectSystem/types";
import { isArray } from "../../../../commons/utils/typeChecks/isSpecificType";

import useReadController from "../../../configs/controllers/CRUD/useReadController";

import { ReadNotesEndpointType } from "./endpointTypes";
import { NOTES_API_URL } from "../endpointsDefinition";
import { API_NoteType } from "../entityTypes";

export const useReadNotes = ({ entityName = "notes" }: ReadNotesEndpointType = {}) => {
  const { readInstance, isLoading } = useReadController();

  //-----------

  // The guard's depth has to match what the .then() reads: the server wraps the collection in
  // a data property, so the consumer reads response.data.data.
  const API_ReadNotes = useCallback(
    async () =>
      readInstance<ResponseDataContaining<{ data: API_NoteType[] }>>({
        entityName,
        configs: { url: NOTES_API_URL.list, method: "GET" },
        responseDataTypeGuard: (
          responseData
        ): responseData is ResponseDataContaining<{ data: API_NoteType[] }> =>
          isArray(responseData?.data)
      }),
    [readInstance, entityName]
  );

  //-----------

  return useMemo(() => ({ API_ReadNotes, isLoading }), [API_ReadNotes, isLoading]);
};
