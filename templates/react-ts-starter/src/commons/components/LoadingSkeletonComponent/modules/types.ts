import React from "react";

export interface LoadingSkeletonComponentType {
  rowsCount?: number;

  customClassNames?: {
    rootContainer?: string;
    row?: string;
  };
  styleConfigs?: React.CSSProperties;
}
