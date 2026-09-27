import { createContext } from "react";

import { useCustomContext } from "../../modules/hooks";

import { defaultToastActionsContextVals, defaultToastStateContextVals } from "./constants";
import { ToastActionsContextType, ToastStateContextType } from "./types";

export const ToastStateContext = createContext<ToastStateContextType>(defaultToastStateContextVals);

export const ToastActionsContext = createContext<ToastActionsContextType>(
  defaultToastActionsContextVals
);

export const useToastStateContext = () => useCustomContext(ToastStateContext);
export const useToastActionsContext = () => useCustomContext(ToastActionsContext);
