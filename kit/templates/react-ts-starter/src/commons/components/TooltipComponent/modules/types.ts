import React, { ReactNode } from "react";

export interface TooltipComponentType {
  title?: string;
  // Set when a caller needs to point at the bubble with aria-describedby.
  bubbleId?: string;
  callerElement?: ReactNode;

  forceHide?: boolean;

  callerContainerConfigs?: React.CSSProperties;
  customClassNames?: {
    rootContainer?: string;
    bubble?: string;
  };
}
