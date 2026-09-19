import { useCallback, useMemo } from "react";

import { useToastActionsContext } from "../../../../../commons/contexts/Toast/modules/ToastContext.context";
import { TOAST_STATE_TYPES as toastTypes } from "../../../../../commons/contexts/Toast/modules/constants";
import { isNullOrEmpty } from "../../../../../commons/utils/typeChecks/isNullOrEmpty";
import { isFunction } from "../../../../../commons/utils/typeChecks/isSpecificType";

import { OnServiceResponseActionHandlerFnType } from "./types";

// Exposed as a hook because "showToast" needs the toast actions context; the returned callback is
// the whole decision of what a finished request does to the UI, and it is the only place that decides.
export const useOnServiceResponseActionHandler = () => {
  const { createToast } = useToastActionsContext();

  const onServiceResponseActionHandler: OnServiceResponseActionHandlerFnType = useCallback(
    ({ handler, responseObj }) => {
      const { action, showConsoleMessage, customMsg } = handler;
      const treatedMsg = isNullOrEmpty(customMsg) ? responseObj.msg : (customMsg as string);

      if (showConsoleMessage) console.warn(`[API] ${treatedMsg}`, responseObj);

      if (isFunction(action)) {
        action();
        return;
      }

      if (action === "silent") return;
      if (isNullOrEmpty(treatedMsg)) return;

      createToast(responseObj.status ? toastTypes.success : toastTypes.error, treatedMsg);
    },
    [createToast]
  );

  return useMemo(() => ({ onServiceResponseActionHandler }), [onServiceResponseActionHandler]);
};
