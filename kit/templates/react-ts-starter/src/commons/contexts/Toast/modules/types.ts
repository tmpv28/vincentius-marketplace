import { DefaultContextValueBrandType } from "../../modules/types";
import { TOAST_STATE_TYPES } from "./constants";

export type ToastStateTypes = (typeof TOAST_STATE_TYPES)[keyof typeof TOAST_STATE_TYPES];

export interface ToastCustomizableConfigsType {
  type: ToastStateTypes;
  title: string;
  msg?: string;

  autoCloseDelay?: number;
}

export interface ToastDetailsType extends ToastCustomizableConfigsType {
  id: string;
}

export type CreateToastFnType = (
  type: ToastStateTypes,
  titleOrToastCreationObj: string | Omit<ToastCustomizableConfigsType, "type">
) => void;

export interface ToastStateContextType extends DefaultContextValueBrandType {
  toasts: ToastDetailsType[];
}

export interface ToastActionsContextType extends DefaultContextValueBrandType {
  createToast: CreateToastFnType;
  createSuccessfulToast: (title: string) => void;
  createErrorToast: (title: string) => void;

  removeToast: (toastId: string) => void;
  clearAllToasts: () => void;
}
