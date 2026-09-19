import { SuccessResponseObjectType } from "../../../../../commons/systems/responseObjectSystem/types";
import { OnServiceResponseActionHandlerType } from "../../../modules/handlers/onServiceResponseActionHandler/types";
import {
  ApiControllerActionType,
  SharedAttributesBetweenControllerAndService
} from "../../../modules/sharedTypes";

// The controller takes partial handlers because it owns the defaults; an endpoint hook only ever
// states the part of the handler that is specific to what the user just did.
export interface ApiCRUDControllerAttrbsType<
  T = any
> extends SharedAttributesBetweenControllerAndService<T> {
  onSuccessHandler?: Partial<OnServiceResponseActionHandlerType>;
  onErrorHandler?: Partial<OnServiceResponseActionHandlerType>;
}

export type ApiCRUDControllerFnType = <T = any>(
  attrbs: ApiCRUDControllerAttrbsType<T>
) => Promise<SuccessResponseObjectType<T>>;

export interface UseApiCRUDControllerConfigType {
  initialLoading?: boolean;
}

export interface UseApiControllerConfigType extends UseApiCRUDControllerConfigType {
  /** Names the operation and supplies the default response messages. */
  actionType: ApiControllerActionType;
  /** What a successful call does when the caller says nothing. */
  defaultOnSuccessHandler: OnServiceResponseActionHandlerType;

  /**
   * Mutations block a second call while one is in flight. Reads do not, because a repeated read is
   * idempotent and blocking it would break re-fetches.
   */
  blocksConcurrentCalls?: boolean;
  /**
   * Reads discard a response that landed after a newer one, so a slow first request cannot
   * overwrite the results of a faster second.
   */
  discardsSupersededResponses?: boolean;
}
