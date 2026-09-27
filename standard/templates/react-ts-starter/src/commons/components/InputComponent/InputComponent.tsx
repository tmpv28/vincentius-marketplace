import React, { useId } from "react";

import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { EMPTY_OBJ, emptyOnClick } from "../../constants/shared";

import { InputComponentType } from "./modules/types";
import "./InputComponent.scss";

const InputComponent: React.FC<InputComponentType> = ({
  label = "",
  name = "",
  value = "",
  placeholder = "",
  errorMsg = "",
  isMultiline = false,
  rowsCount = 4,
  disabled = false,
  readOnly = false,
  autoFocus = false,
  onChange = emptyOnClick,
  onKeyDown = emptyOnClick,
  onBlur = emptyOnClick,
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: InputComponentType) => {
  const hasError = !isNullOrEmpty(errorMsg);

  const fieldId = useId();
  const errorMsgId = `${fieldId}-error`;

  // The three interaction states land on the field, which is the control the user acts on, and
  // they come from the global vocabulary so every blocked control in the app looks blocked alike.
  const classNames = {
    rootContainer: `InputComponent ${customClassNames.rootContainer || ""}`,
    label: `InputComponent__label ${customClassNames.label || ""}`,
    field: `InputComponent__field ${isMultiline ? "InputComponent__field--multiline" : ""} ${customClassNames.field || ""} ${disabled ? "disabledAction" : ""} ${readOnly ? "readOnlyAction" : ""} ${hasError ? "errorAction" : ""}`,
    errorMsg: `InputComponent__errorMsg ${customClassNames.errorMsg || ""}`
  };

  //-----------

  // Emits the shared return-event shape so every field is wired by name, and that name is the
  // payload key, which is the API type's key. One rename propagates or fails to compile.
  const handleInputValueChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange({ target: { name, value: event.target.value } });
  };

  //-----------

  return (
    <label htmlFor={fieldId} className={classNames.rootContainer} style={styleConfigs}>
      {!isNullOrEmpty(label) && <span className={classNames.label}>{label}</span>}

      {isMultiline ? (
        <textarea
          id={fieldId}
          name={name}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorMsgId : undefined}
          className={classNames.field}
          value={value}
          rows={rowsCount}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          onChange={handleInputValueChange}
          onKeyDown={onKeyDown}
          onBlur={() => onBlur(value)}
        />
      ) : (
        <input
          id={fieldId}
          type="text"
          name={name}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorMsgId : undefined}
          className={classNames.field}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          onChange={handleInputValueChange}
          onKeyDown={onKeyDown}
          onBlur={() => onBlur(value)}
        />
      )}

      {hasError && (
        <span id={errorMsgId} role="alert" className={classNames.errorMsg}>
          {errorMsg}
        </span>
      )}
    </label>
  );
};

export default InputComponent;
