import { useMemo } from "react";

import { API_READ_CONTROLLER_DEFAULT_ON_SUCCESS_HANDLER_CONFIGS as defaultOnSuccessHandler } from "../../modules/handlers/onServiceResponseActionHandler/constants";
import { API_CONTROLLER_ACTION_TYPES as actionTypes } from "../../modules/handlers/apiControllerActionTypesHandler";

import { UseApiCRUDControllerConfigType } from "./modules/types";
import { useApiController } from "./modules/useApiController";

// A read does not block a concurrent call, because a repeated read is idempotent and blocking it
// would break a legitimate re-fetch. It does discard a superseded response, so a slow first
// request cannot overwrite the results of a faster second.
const useReadController = ({ initialLoading = false }: UseApiCRUDControllerConfigType = {}) => {
  const { performInstance, isLoading } = useApiController({
    actionType: actionTypes.read,
    defaultOnSuccessHandler,
    discardsSupersededResponses: true,
    initialLoading
  });

  return useMemo(
    () => ({ readInstance: performInstance, isLoading }),
    [performInstance, isLoading]
  );
};

export default useReadController;
