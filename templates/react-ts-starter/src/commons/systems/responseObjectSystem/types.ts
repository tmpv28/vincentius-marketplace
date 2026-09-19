import { RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS } from "./constants";

export type ResponseObjectDefaultStatusCodeMsgs =
  (typeof RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS)[keyof typeof RESPONSE_OBJECT_DEFAULT_STATUS_CODE_MSGS];

export interface BaseResponseObjectType<T = any> {
  /** Indicates whether the process was successful (default: false). */
  status: boolean;
  /** Specific status code message for further inspection. */
  statusCodeMsg: string;
  /**
   * Raw HTTP status (e.g. 403), additive to statusCodeMsg (BE business code).
   * Undefined for non-HTTP responses (local validations, aborts).
   */
  httpStatus?: number;
  /** Description of the process status. */
  msg: string;
  /** Optional data payload associated with the response. */
  data?: T;
  headers?: any;
  handledRejection: boolean;
}

export interface ResponseObjectType<T = any> extends BaseResponseObjectType<T> {
  isResponseObjectType: true;
}

export type SuccessResponseObjectType<T = any> = ResponseObjectType<T> & {
  status: true;
  data: T;
};
export type FailedResponseObjectType<T = any> = ResponseObjectType<T> & { status: false };

// Describes the SHAPE of the raw response payload a type guard inspects, never the narrowed value.
// The intersection keeps the payload open, so a guard asserting `{ data: NoteType }` does not
// claim the server sent nothing else.
export type ResponseDataContaining<T> = T & Record<string, any>;
