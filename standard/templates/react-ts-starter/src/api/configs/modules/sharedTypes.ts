import { AxiosRequestConfig } from "axios";

import {
  ResponseDataContaining,
  ResponseObjectType
} from "../../../commons/systems/responseObjectSystem/types";

export type ApiControllerActionType = {
  name: string;
  // Present-tense verb used to build the default success/error messages ("add", "update", "delete").
  verb: string;
};

export interface DefaultEndpointHandlingType {
  // Human-readable entity label used by the default response messages.
  entityName?: string;
}

export type ResponseDataTypeGuardFnType<T> = (
  responseData: any
) => responseData is ResponseDataContaining<T>;

export interface SharedAttributesBetweenControllerAndService<T = any> {
  entityName?: string;
  configs: AxiosRequestConfig;
  responseDataTypeGuard?: ResponseDataTypeGuardFnType<T>;
  extraValidationsBeforePerformingApiService?: () => ResponseObjectType | undefined;
  customActionTypeConfigs?: Partial<ApiControllerActionType>;
}

export type RefreshDataHandlerFnType = () => void;
