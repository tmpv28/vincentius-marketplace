import { SuccessResponseObjectType } from "../../../../commons/systems/responseObjectSystem/types";
import {
  ApiControllerActionType,
  SharedAttributesBetweenControllerAndService
} from "../../modules/sharedTypes";
import { OnServiceResponseActionHandlerType } from "../../modules/handlers/onServiceResponseActionHandler/types";

export interface PerformApiServiceAttrbsType<
  T = any
> extends SharedAttributesBetweenControllerAndService<T> {
  actionType: ApiControllerActionType;

  onSuccessHandler: OnServiceResponseActionHandlerType;
  onErrorHandler: OnServiceResponseActionHandlerType;
}

export type PerformApiServiceFnType = <T = any>(
  attrbs: PerformApiServiceAttrbsType<T>
) => Promise<SuccessResponseObjectType<T>>;
