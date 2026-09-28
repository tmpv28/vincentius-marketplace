import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { isString } from "../../utils/typeChecks/isSpecificType";
import { EMPTY_ARRAY } from "../../constants/shared";

import { GenericProviderType } from "../modules/types";

import { ToastActionsContext, ToastStateContext } from "./modules/ToastContext.context";
import {
  TOAST_DEFAULT_AUTO_CLOSE_DELAY as toastDefaultDelay,
  TOAST_STATE_TYPES as toastTypes
} from "./modules/constants";
import { CreateToastFnType, ToastDetailsType } from "./modules/types";

const ToastContext: React.FC<GenericProviderType> = ({ children }: GenericProviderType) => {
  const [toasts, setToasts] = useState<ToastDetailsType[]>(EMPTY_ARRAY);

  // Timeout ids live on a ref so scheduling an auto-dismiss never changes a callback identity,
  // which is what keeps the actions context effectively immutable.
  const autoCloseTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  //-----------

  const removeToast = useCallback((toastId: string) => {
    setToasts((prevToasts) => prevToasts.filter((toastInstance) => toastInstance.id !== toastId));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts((prevToasts) => (isNullOrEmpty(prevToasts) ? prevToasts : EMPTY_ARRAY));
  }, []);

  const createToast: CreateToastFnType = useCallback(
    (type, titleOrToastCreationObj) => {
      const toastConfigs = isString(titleOrToastCreationObj)
        ? { title: titleOrToastCreationObj }
        : titleOrToastCreationObj;

      const newToast: ToastDetailsType = {
        ...toastConfigs,
        type,
        id: `Toast_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      };

      setToasts((prevToasts) => [...prevToasts, newToast]);

      // || rather than ??, on purpose: a delay of 0 would dismiss the toast before it is seen, so
      // 0 falls back to the default exactly like an absent delay.
      const treatedDelay = newToast.autoCloseDelay || toastDefaultDelay;
      autoCloseTimeoutsRef.current.push(setTimeout(() => removeToast(newToast.id), treatedDelay));
    },
    [removeToast]
  );

  const createSuccessfulToast = useCallback(
    (title: string) => createToast(toastTypes.success, title),
    [createToast]
  );

  const createErrorToast = useCallback(
    (title: string) => createToast(toastTypes.error, title),
    [createToast]
  );

  useEffect(
    () => () => {
      autoCloseTimeoutsRef.current.forEach((timeoutInstance) => clearTimeout(timeoutInstance));
    },
    []
  );

  const stateValue = useMemo(() => ({ toasts }), [toasts]);

  const actionsValue = useMemo(
    () => ({ createToast, createSuccessfulToast, createErrorToast, removeToast, clearAllToasts }),
    [createToast, createSuccessfulToast, createErrorToast, removeToast, clearAllToasts]
  );

  //-----------

  return (
    <ToastActionsContext.Provider value={actionsValue}>
      <ToastStateContext.Provider value={stateValue}>{children}</ToastStateContext.Provider>
    </ToastActionsContext.Provider>
  );
};

export default ToastContext;
