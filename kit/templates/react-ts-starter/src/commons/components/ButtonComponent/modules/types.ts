import React, { ReactNode } from "react";

import { OnClickType } from "../../../types/generic";

import { BUTTON_COMPONENT_SIZES, BUTTON_COMPONENT_STYLE_TYPES } from "./constants";

export type ButtonComponentSizes =
  (typeof BUTTON_COMPONENT_SIZES)[keyof typeof BUTTON_COMPONENT_SIZES];

export type ButtonComponentStyleTypes =
  (typeof BUTTON_COMPONENT_STYLE_TYPES)[keyof typeof BUTTON_COMPONENT_STYLE_TYPES];

export interface ButtonComponentType {
  children?: ReactNode;
  customIcon?: ReactNode;
  badge?: string | number;
  tooltipTitle?: string;
  // The accessible name when the button shows only an icon; a tooltip is not one.
  ariaLabel?: string;

  size?: ButtonComponentSizes;
  styleType?: ButtonComponentStyleTypes;
  paddingSize?: ButtonComponentSizes;

  disabled?: boolean;
  isLoading?: boolean;

  onClickAction?: OnClickType;

  customClassNames?: {
    rootContainer?: string;
    icon?: string;
    spinner?: string;
    badge?: string;
  };
  styleConfigs?: React.CSSProperties;
}
