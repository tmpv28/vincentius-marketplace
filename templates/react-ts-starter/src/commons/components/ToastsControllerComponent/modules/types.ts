import React from "react";

export interface ToastsControllerComponentType {
  customClassNames?: {
    rootContainer?: string;
    toast?: string;
    title?: string;
    msg?: string;
  };
  styleConfigs?: React.CSSProperties;
}
