import React, { useId } from "react";

import TooltipComponent from "../TooltipComponent/TooltipComponent";

import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { EMPTY_OBJ, emptyOnClick } from "../../constants/shared";

import {
  BUTTON_COMPONENT_SIZES as buttonSizes,
  BUTTON_COMPONENT_STYLE_TYPES as buttonStyleTypes
} from "./modules/constants";
import { ButtonComponentType } from "./modules/types";
import "./ButtonComponent.scss";

const ButtonComponent: React.FC<ButtonComponentType> = ({
  children = null,
  customIcon = null,
  badge = "",
  tooltipTitle = "",
  size = buttonSizes.normal,
  styleType = buttonStyleTypes.normal,
  paddingSize,
  disabled = false,
  isLoading = false,
  onClickAction = emptyOnClick,
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: ButtonComponentType) => {
  const isButtonBlocked = disabled || isLoading;

  // A control blocked by validation stays focusable so a keyboard user can reach it and have the
  // reason read out. Only a control with no reason to give is hard-disabled and skipped entirely.
  const hasBlockingReason = !isNullOrEmpty(tooltipTitle) && isButtonBlocked;
  const tooltipBubbleId = `${useId()}-tooltip`;

  // One entry per DOM part, so the map mirrors what the component renders and pairs 1:1 with the
  // customClassNames escape hatch.
  const classNames = {
    rootContainer: `ButtonComponent ButtonComponent--${size} ButtonComponent--${styleType} ${paddingSize ? `ButtonComponent--paddingSize__${paddingSize}` : ""} ${customClassNames.rootContainer || ""} ${isButtonBlocked ? "disabledAction" : ""}`,
    icon: `ButtonComponent__icon ${customClassNames.icon || ""}`,
    spinner: `ButtonComponent__spinner ${customClassNames.spinner || ""}`,
    badge: `ButtonComponent__badge ${customClassNames.badge || ""}`
  };

  //-----------

  return (
    <TooltipComponent
      title={tooltipTitle}
      bubbleId={tooltipBubbleId}
      callerElement={
        <button
          type="button"
          className={classNames.rootContainer}
          style={styleConfigs}
          disabled={isButtonBlocked && !hasBlockingReason}
          aria-disabled={isButtonBlocked}
          aria-describedby={hasBlockingReason ? tooltipBubbleId : undefined}
          onClick={isButtonBlocked ? emptyOnClick : onClickAction}
        >
          {customIcon && <span className={classNames.icon}>{customIcon}</span>}

          {isLoading && <span className={classNames.spinner} />}

          {children}

          {!isNullOrEmpty(badge) && <span className={classNames.badge}>{badge}</span>}
        </button>
      }
    />
  );
};

export default ButtonComponent;
