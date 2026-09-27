import React from "react";

import {
  useToastActionsContext,
  useToastStateContext
} from "../../contexts/Toast/modules/ToastContext.context";
import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { EMPTY_OBJ } from "../../constants/shared";

import { ToastsControllerComponentType } from "./modules/types";
import "./ToastsControllerComponent.scss";

// Mounted once, next to the Outlet, so the stack is one surface instead of a portal per feature.
const ToastsControllerComponent: React.FC<ToastsControllerComponentType> = ({
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: ToastsControllerComponentType) => {
  const { toasts } = useToastStateContext();
  const { removeToast } = useToastActionsContext();

  const classNames = {
    rootContainer: `ToastsControllerComponent ${customClassNames.rootContainer || ""}`,
    toast: `ToastsControllerComponent__toast ${customClassNames.toast || ""}`,
    title: `ToastsControllerComponent__title ${customClassNames.title || ""}`,
    msg: `ToastsControllerComponent__msg ${customClassNames.msg || ""}`
  };

  //-----------

  if (isNullOrEmpty(toasts)) return null;

  return (
    <div className={classNames.rootContainer} style={styleConfigs}>
      {toasts.map((toastInstance) => (
        <div
          key={`Toast_${toastInstance.id}`}
          className={`${classNames.toast} ToastsControllerComponent__toast--${toastInstance.type}`}
          onClick={() => removeToast(toastInstance.id)}
        >
          <span className={classNames.title}>{toastInstance.title}</span>

          {!isNullOrEmpty(toastInstance.msg) && (
            <span className={classNames.msg}>{toastInstance.msg}</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastsControllerComponent;
