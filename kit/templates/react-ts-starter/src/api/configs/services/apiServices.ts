import { useCallback, useMemo } from "react";
import axios, { AxiosResponse } from "axios";

import { RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS as statusCodeMsgs } from "../../../commons/systems/responseObjectSystem/constants";
import {
  FailedResponseObjectType,
  ResponseObjectType,
  SuccessResponseObjectType
} from "../../../commons/systems/responseObjectSystem/types";
import { createResponseObject } from "../../../commons/systems/responseObjectSystem/utils";
import { isNullOrEmpty } from "../../../commons/utils/typeChecks/isNullOrEmpty";

import { useOnServiceResponseActionHandler } from "../modules/handlers/onServiceResponseActionHandler/onServiceResponseActionHandler";
import { OnServiceResponseActionHandlerType } from "../modules/handlers/onServiceResponseActionHandler/types";

import { PerformApiServiceAttrbsType } from "./modules/types";

// One module-level instance: the base URL is a build-time constant, so rebuilding it per render
// would only churn identities and scatter where interceptors could ever be attached.
const apiInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" }
});

export const useHandleConnectionsToAPI = () => {
  const { onServiceResponseActionHandler } = useOnServiceResponseActionHandler();

  // A caller's handler is arbitrary code. If it throws, that is the handler's bug, and it must
  // not become the rejection value: the layer's one guarantee is that callers always catch a
  // response object.
  const dispatchResponseAction = useCallback(
    (handler: OnServiceResponseActionHandlerType, responseObj: ResponseObjectType) => {
      try {
        onServiceResponseActionHandler({ handler, responseObj });
      } catch (handlerError) {
        console.error("An API response handler threw and was contained.", handlerError);
      }
    },
    [onServiceResponseActionHandler]
  );

  //-----------

  const PerformApiService = useCallback(
    async <T = any>({
      entityName = "",
      configs,
      actionType,
      responseDataTypeGuard,
      extraValidationsBeforePerformingApiService,
      onSuccessHandler,
      onErrorHandler
    }: PerformApiServiceAttrbsType<T>): Promise<SuccessResponseObjectType<T>> => {
      const rejectWith = (responseObj: FailedResponseObjectType<T>) => {
        dispatchResponseAction(onErrorHandler, responseObj);
        return Promise.reject(responseObj);
      };

      // Local refusals never reach the network, and they carry their own message upward.
      // The validator is caller-supplied, so a throw inside it is converted rather than escaping.
      let preRequestRefusalResponseObj: ResponseObjectType | undefined;
      try {
        preRequestRefusalResponseObj = extraValidationsBeforePerformingApiService?.();
      } catch (validationError) {
        return rejectWith(
          createResponseObject<T>({
            statusCodeMsg: statusCodeMsgs.error,
            msg: `Could not ${actionType.name} ${entityName}. ${String(validationError)}`,
            handledRejection: true
          })
        );
      }

      if (preRequestRefusalResponseObj)
        return rejectWith(
          createResponseObject<T>({
            ...preRequestRefusalResponseObj,
            status: false,
            handledRejection: true
          })
        );

      // The try wraps the request and nothing else. A success handler that throws must not land
      // in the catch and be reported as a failed request that actually succeeded.
      let response: AxiosResponse;
      try {
        response = await apiInstance.request(configs);
      } catch (error) {
        // A cancelled request is not a failure the user did anything about, so it is rejected
        // quietly rather than toasted and logged.
        if (axios.isCancel(error))
          return Promise.reject(
            createResponseObject<T>({
              statusCodeMsg: statusCodeMsgs.warning,
              msg: `The ${actionType.name} ${entityName} request was cancelled.`,
              handledRejection: true
            })
          );

        // isAxiosError is a real predicate, so a failure thrown by our own code is reported as
        // itself instead of being described as an empty HTTP response.
        const axiosError = axios.isAxiosError<{ message?: string }>(error) ? error : undefined;
        const serverMsg = axiosError?.response?.data?.message;
        const failureMsg = axiosError?.message ?? String(error);

        return rejectWith(
          createResponseObject<T>({
            statusCodeMsg: statusCodeMsgs.error,
            httpStatus: axiosError?.response?.status,
            msg: isNullOrEmpty(serverMsg)
              ? `Could not ${actionType.name} ${entityName}. ${failureMsg}`
              : serverMsg,
            headers: axiosError?.response?.headers,
            handledRejection: true
          })
        );
      }

      // The guard is where any stops. A payload that does not match what we claimed is an
      // error here, not a surprise in a component three layers up.
      if (responseDataTypeGuard && !responseDataTypeGuard(response.data))
        return rejectWith(
          createResponseObject<T>({
            statusCodeMsg: statusCodeMsgs.error,
            httpStatus: response.status,
            msg: `Could not ${actionType.name} ${entityName}: the server returned an unexpected shape.`,
            headers: response.headers,
            handledRejection: true
          })
        );

      const successResponseObj = createResponseObject<T>({
        status: true,
        statusCodeMsg: statusCodeMsgs.success,
        httpStatus: response.status,
        msg: `${entityName} ${actionType.verb} successfully.`,
        data: response.data,
        headers: response.headers
      });

      dispatchResponseAction(onSuccessHandler, successResponseObj);
      return successResponseObj;
    },
    [dispatchResponseAction]
  );

  //-----------

  return useMemo(() => ({ PerformApiService }), [PerformApiService]);
};
