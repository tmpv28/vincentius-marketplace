import { OnServiceResponseActionHandlerType } from "./types";

export const API_MUTATION_CONTROLLER_DEFAULT_ON_SUCCESS_HANDLER_CONFIGS: OnServiceResponseActionHandlerType =
  {
    action: "showToast",
    showConsoleMessage: false
  };

export const API_READ_CONTROLLER_DEFAULT_ON_SUCCESS_HANDLER_CONFIGS: OnServiceResponseActionHandlerType =
  {
    action: "silent",
    showConsoleMessage: false
  };

export const API_CONTROLLER_DEFAULT_ON_ERROR_HANDLER_CONFIGS: OnServiceResponseActionHandlerType = {
  action: "showToast",
  showConsoleMessage: true
};
