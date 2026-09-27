import React, { useId } from "react";
import { Modal } from "@mantine/core";

import LoadingSkeletonComponent from "../LoadingSkeletonComponent/LoadingSkeletonComponent";
import ButtonComponent from "../ButtonComponent/ButtonComponent";

import { BUTTON_COMPONENT_STYLE_TYPES as buttonStyleTypes } from "../ButtonComponent/modules/constants";
import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { EMPTY_OBJ, emptyOnClick } from "../../constants/shared";

import { GenericModalComponentType } from "./modules/types";
import "./GenericModalComponent.scss";

// The only component that touches the UI library's modal. Everything above this line talks to
// these props, so swapping the library is a bounded edit in one file.
const GenericModalComponent: React.FC<GenericModalComponentType> = ({
  title = "",
  subtitle = "",
  children = null,
  isGenericModalOpen = false,
  isLoading = false,
  confirmationButtonConfig = EMPTY_OBJ,
  cancelationButtonConfig = EMPTY_OBJ,
  onClose = emptyOnClick,
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: GenericModalComponentType) => {
  const classNames = {
    rootContainer: `GenericModalComponent ${customClassNames.rootContainer || ""}`,
    content: `GenericModalComponent__content ${customClassNames.content || ""}`,
    header: `GenericModalComponent__header ${customClassNames.header || ""}`,
    title: `GenericModalComponent__title ${customClassNames.title || ""}`,
    subtitle: `GenericModalComponent__subtitle ${customClassNames.subtitle || ""}`,
    body: `GenericModalComponent__body ${customClassNames.body || ""}`,
    footer: `GenericModalComponent__footer ${customClassNames.footer || ""}`
  };

  const titleId = `${useId()}-title`;

  //-----------

  return (
    <Modal
      opened={isGenericModalOpen}
      onClose={onClose}
      centered
      withCloseButton={false}
      aria-labelledby={titleId}
      className={classNames.rootContainer}
    >
      <div className={classNames.content} style={styleConfigs}>
        <div className={classNames.header}>
          {!isNullOrEmpty(title) && (
            <h2 id={titleId} className={classNames.title}>
              {title}
            </h2>
          )}

          {!isNullOrEmpty(subtitle) && <p className={classNames.subtitle}>{subtitle}</p>}
        </div>

        <div className={classNames.body}>
          {isLoading ? <LoadingSkeletonComponent rowsCount={2} /> : children}
        </div>

        <div className={classNames.footer}>
          <ButtonComponent
            styleType={buttonStyleTypes.transparentWithBorder}
            disabled={cancelationButtonConfig.disabled}
            tooltipTitle={cancelationButtonConfig.tooltipTitle}
            onClickAction={cancelationButtonConfig.onClickAction || onClose}
          >
            {cancelationButtonConfig.label || "Cancel"}
          </ButtonComponent>

          <ButtonComponent
            styleType={buttonStyleTypes.accent}
            isLoading={isLoading}
            disabled={confirmationButtonConfig.disabled}
            tooltipTitle={confirmationButtonConfig.tooltipTitle}
            onClickAction={confirmationButtonConfig.onClickAction || emptyOnClick}
          >
            {confirmationButtonConfig.label || "Confirm"}
          </ButtonComponent>
        </div>
      </div>
    </Modal>
  );
};

export default GenericModalComponent;
