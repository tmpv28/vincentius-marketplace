import React from "react";

import { EMPTY_OBJ } from "../../constants/shared";

import { EmptyStateComponentType } from "./modules/types";
import "./EmptyStateComponent.scss";

const EmptyStateComponent: React.FC<EmptyStateComponentType> = ({
  message = "Nothing to show here yet.",
  customIcon = null,
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: EmptyStateComponentType) => {
  const classNames = {
    rootContainer: `EmptyStateComponent ${customClassNames.rootContainer || ""}`,
    icon: `EmptyStateComponent__icon ${customClassNames.icon || ""}`,
    message: `EmptyStateComponent__message ${customClassNames.message || ""}`
  };

  //-----------

  return (
    <div className={classNames.rootContainer} style={styleConfigs}>
      {customIcon && <div className={classNames.icon}>{customIcon}</div>}

      <p className={classNames.message}>{message}</p>
    </div>
  );
};

export default EmptyStateComponent;
