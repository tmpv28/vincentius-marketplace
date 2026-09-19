import React, { ReactNode } from "react";

import { OnClickType } from "../../../types/generic";

// Four related props travel as one named concept, so a modal's footer is configured, not assembled.
export interface GenericModalButtonConfigType {
  label?: string;
  onClickAction?: OnClickType;
  disabled?: boolean;
  tooltipTitle?: string;
}

export interface GenericModalComponentType {
  title?: string;
  subtitle?: string;
  children?: ReactNode;

  isGenericModalOpen?: boolean;
  isLoading?: boolean;

  confirmationButtonConfig?: GenericModalButtonConfigType;
  cancelationButtonConfig?: GenericModalButtonConfigType;

  onClose?: OnClickType;

  customClassNames?: {
    rootContainer?: string;
    content?: string;
    header?: string;
    title?: string;
    subtitle?: string;
    body?: string;
    footer?: string;
  };
  styleConfigs?: React.CSSProperties;
}
