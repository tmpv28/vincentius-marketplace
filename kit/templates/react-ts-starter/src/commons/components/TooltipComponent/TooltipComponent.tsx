import React from "react";

import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { EMPTY_OBJ } from "../../constants/shared";

import { TooltipComponentType } from "./modules/types";
import "./TooltipComponent.scss";

// Pure CSS on purpose: a tooltip is hover state and one absolutely positioned box, and a library
// for that is a dependency to audit, version and eventually migrate off.
const TooltipComponent: React.FC<TooltipComponentType> = ({
  title = "",
  bubbleId = "",
  callerElement = null,
  forceHide = false,
  callerContainerConfigs = EMPTY_OBJ,
  customClassNames = EMPTY_OBJ
}: TooltipComponentType) => {
  const isTooltipHidden = forceHide || isNullOrEmpty(title);

  const classNames = {
    rootContainer: `TooltipComponent ${customClassNames.rootContainer || ""} ${isTooltipHidden ? "TooltipComponent--hidden" : ""}`,
    bubble: `TooltipComponent__bubble ${customClassNames.bubble || ""}`
  };

  //-----------

  return (
    <span className={classNames.rootContainer} style={callerContainerConfigs}>
      {callerElement}

      {!isTooltipHidden && (
        <span id={bubbleId} role="tooltip" className={classNames.bubble}>
          {title}
        </span>
      )}
    </span>
  );
};

export default TooltipComponent;
