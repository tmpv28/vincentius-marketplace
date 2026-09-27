import { isObject } from "../../utils/typeChecks/isSpecificType";
import { RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS } from "./constants";
import {
  BaseResponseObjectType,
  FailedResponseObjectType,
  ResponseObjectType,
  SuccessResponseObjectType
} from "./types";

/**
 * Creates a generic response object for process flow handling.
 * @param opts - See {@link BaseResponseObjectType}.
 * @returns The response object, with `isResponseObjectType` set so guards can recognise it.
 */
export function createResponseObject<T>(
  opts: Partial<BaseResponseObjectType<T>> & { status: true }
): SuccessResponseObjectType<T>;
export function createResponseObject<T>(
  opts?: Partial<BaseResponseObjectType<T>>
): FailedResponseObjectType<T>;
export function createResponseObject<T>({
  status = false,
  statusCodeMsg = "",
  httpStatus,
  msg = "",
  data,
  headers,
  handledRejection = false
}: Partial<BaseResponseObjectType<T>> = {}): ResponseObjectType<T> {
  return {
    isResponseObjectType: true,
    status,
    statusCodeMsg,
    httpStatus,
    msg,
    data,
    headers,
    handledRejection
  };
}

// Builds a warning-severity response object (status false, WARN status code) for field/form validations.
export const createWarningResponseObject = (msg: string): ResponseObjectType =>
  createResponseObject({
    status: false,
    statusCodeMsg: RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS.warning,
    msg
  });

// Builds an error-severity response object (status false, ERROR status code) for field/form validations.
export const createErrorResponseObject = (msg: string): ResponseObjectType =>
  createResponseObject({
    status: false,
    statusCodeMsg: RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS.error,
    msg
  });

/**
 * Validates if a given variable is of the custom ResponseObject type.
 * @param obj
 * @returns boolean
 */
export const isResponseObjectType = (obj: any): obj is ResponseObjectType => {
  return isObject(obj) && "isResponseObjectType" in obj && obj.isResponseObjectType === true;
};
