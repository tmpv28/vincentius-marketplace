import React, { ReactNode } from "react";

export interface EmptyStateComponentType {
  message?: string;
  customIcon?: ReactNode;

  customClassNames?: {
    rootContainer?: string;
    icon?: string;
    message?: string;
  };
  styleConfigs?: React.CSSProperties;
}
