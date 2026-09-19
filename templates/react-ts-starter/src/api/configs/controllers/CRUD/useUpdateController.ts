import { useMemo } from "react";

import { API_MUTATION_CONTROLLER_DEFAULT_ON_SUCCESS_HANDLER_CONFIGS as defaultOnSuccessHandler } from "../../modules/handlers/onServiceResponseActionHandler/constants";
import { API_CONTROLLER_ACTION_TYPES as actionTypes } from "../../modules/handlers/apiControllerActionTypesHandler";

import { UseApiCRUDControllerConfigType } from "./modules/types";
import { useApiController } from "./modules/useApiController";

const useUpdateController = ({ initialLoading = false }: UseApiCRUDControllerConfigType = {}) => {
  const { performInstance, isLoading } = useApiController({
    actionType: actionTypes.update,
    defaultOnSuccessHandler,
    blocksConcurrentCalls: true,
    initialLoading
  });

  return useMemo(
    () => ({ updateInstance: performInstance, isLoading }),
    [performInstance, isLoading]
  );
};

export default useUpdateController;
