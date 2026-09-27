import { ResponseObjectType } from "../../../../../commons/systems/responseObjectSystem/types";

export type OnServiceResponseActionType = "showToast" | "silent" | (() => void);

export interface OnServiceResponseActionHandlerType {
  action: OnServiceResponseActionType;
  showConsoleMessage: boolean;
  // Overrides the message the default handler would have built from actionType + entityName.
  customMsg?: string;
}

export type OnServiceResponseActionHandlerFnType = (attrbs: {
  handler: OnServiceResponseActionHandlerType;
  responseObj: ResponseObjectType;
}) => void;
