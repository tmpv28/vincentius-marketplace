import { useCallback, useMemo, useRef } from "react";

import { createResponseObject } from "../../../../../commons/systems/responseObjectSystem/utils";

import { useOnServiceResponseActionHandler } from "../../../modules/handlers/onServiceResponseActionHandler/onServiceResponseActionHandler";
import { API_CONTROLLER_DEFAULT_ON_ERROR_HANDLER_CONFIGS as defaultOnErrorHandler } from "../../../modules/handlers/onServiceResponseActionHandler/constants";
import { useHandleConnectionsToAPI } from "../../../services/apiServices";

import { ApiCRUDControllerAttrbsType, UseApiControllerConfigType } from "./types";
import { useLoadingState } from "./useLoadingState";

/**
 * The single controller. Every CRUD controller is this hook with a different action type and a
 * different concurrency policy, so the four of them are named wrappers rather than four copies.
 * @param configs - See {@link UseApiControllerConfigType}.
 * @returns `performInstance` to run a call, and `isLoading` for the call in flight.
 */
export const useApiController = ({
  actionType,
  defaultOnSuccessHandler,
  blocksConcurrentCalls = false,
  discardsSupersededResponses = false,
  initialLoading = false
}: UseApiControllerConfigType) => {
  const { PerformApiService } = useHandleConnectionsToAPI();
  const { onServiceResponseActionHandler } = useOnServiceResponseActionHandler();
  const { isLoading, withLoading } = useLoadingState({ initialLoading });

  const processingRef = useRef<boolean>(false);
  const latestRequestIdRef = useRef<number>(0);

  //-----------

  const performInstance = useCallback(
    <T = any>({
      onSuccessHandler,
      onErrorHandler,
      customActionTypeConfigs,
      ...restOfServiceAttributes
    }: ApiCRUDControllerAttrbsType<T>) => {
      const treatedOnErrorHandler = { ...defaultOnErrorHandler, ...onErrorHandler };

      // A blocked call still runs the error handler. Rejecting silently leaves the user with a
      // dead click and the console with an unhandled rejection.
      if (blocksConcurrentCalls && processingRef.current) {
        const blockedResponseObj = createResponseObject({
          msg: `Action blocked: ${actionType.name} already processing.`,
          handledRejection: true
        });
        onServiceResponseActionHandler({
          handler: treatedOnErrorHandler,
          responseObj: blockedResponseObj
        });
        return Promise.reject(blockedResponseObj);
      }

      processingRef.current = true;

      latestRequestIdRef.current += 1;
      const thisRequestId = latestRequestIdRef.current;

      return withLoading(() =>
        PerformApiService<T>({
          ...restOfServiceAttributes,
          actionType: { ...actionType, ...customActionTypeConfigs },
          onSuccessHandler: { ...defaultOnSuccessHandler, ...onSuccessHandler },
          onErrorHandler: treatedOnErrorHandler
        }).then((responseObj) => {
          if (discardsSupersededResponses && thisRequestId !== latestRequestIdRef.current)
            return Promise.reject(
              createResponseObject({
                msg: `A newer ${actionType.name} superseded this one.`,
                handledRejection: true
              })
            );
          return responseObj;
        })
      ).finally(() => {
        processingRef.current = false;
      });
    },
    [
      PerformApiService,
      withLoading,
      onServiceResponseActionHandler,
      actionType,
      defaultOnSuccessHandler,
      blocksConcurrentCalls,
      discardsSupersededResponses
    ]
  );

  //-----------

  return useMemo(() => ({ performInstance, isLoading }), [performInstance, isLoading]);
};
