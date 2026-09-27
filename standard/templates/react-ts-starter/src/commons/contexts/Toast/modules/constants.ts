import { EMPTY_ARRAY, emptyOnClick } from "../../../constants/shared";
import { ToastActionsContextType, ToastStateContextType } from "./types";

export const TOAST_STATE_TYPES = {
  success: "success",
  error: "error",
  warning: "warning",
  info: "info"
} as const;

export const TOAST_DEFAULT_AUTO_CLOSE_DELAY = 4000;

// Real default values, built from the shared sentinels: a fresh [] here would be a new identity
// on every render, and a new identity is a re-render for every consumer.
export const defaultToastStateContextVals: ToastStateContextType = {
  isDefaultContextValue: true,
  toasts: EMPTY_ARRAY
};

export const defaultToastActionsContextVals: ToastActionsContextType = {
  isDefaultContextValue: true,
  createToast: emptyOnClick,
  createSuccessfulToast: emptyOnClick,
  createErrorToast: emptyOnClick,
  removeToast: emptyOnClick,
  clearAllToasts: emptyOnClick
};
