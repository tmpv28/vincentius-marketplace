import React from "react";

import { ReturnEventType } from "../../../types/generic";

export type HandledReturnInputValueType = string | number;

export interface InputComponentType {
  label?: string;
  name?: string;
  value?: HandledReturnInputValueType;
  placeholder?: string;
  errorMsg?: string;

  isMultiline?: boolean;
  rowsCount?: number;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;

  onChange?: (event: ReturnEventType) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (inputValue?: HandledReturnInputValueType) => void;

  customClassNames?: {
    rootContainer?: string;
    label?: string;
    field?: string;
    errorMsg?: string;
  };
  styleConfigs?: React.CSSProperties;
}
