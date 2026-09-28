import React, { useCallback } from "react";

import ButtonComponent from "../../../commons/components/ButtonComponent/ButtonComponent";

import {
  BUTTON_COMPONENT_SIZES as buttonSizes,
  BUTTON_COMPONENT_STYLE_TYPES as buttonStyleTypes
} from "../../../commons/components/ButtonComponent/modules/constants";
import { useToastActionsContext } from "../../../commons/contexts/Toast/modules/ToastContext.context";
import { emptyOnClick } from "../../../commons/constants/shared";

import useDeleteNoteValidations from "./modules/deleteNoteValidations";
import { DeleteNoteFeatureType } from "./modules/types";

const DeleteNoteFeature: React.FC<DeleteNoteFeatureType> = ({
  noteData,
  onNoteDeletedHandler = emptyOnClick
}: DeleteNoteFeatureType) => {
  const { createSuccessfulToast } = useToastActionsContext();

  const { deleteNoteButtonsValidationResponseObj } = useDeleteNoteValidations({ noteData });

  //-----------

  // The demo removes locally. useDeleteNote in api/queries/notes/delete is the call to swap this
  // body for once a backend exists; it toasts on success, so this toast goes with the swap.
  const deleteNoteHandler = useCallback(() => {
    if (!deleteNoteButtonsValidationResponseObj.deleteNote.status) return;

    onNoteDeletedHandler(noteData);
    createSuccessfulToast(`${noteData.title} deleted successfully.`);
  }, [
    deleteNoteButtonsValidationResponseObj.deleteNote,
    onNoteDeletedHandler,
    createSuccessfulToast,
    noteData
  ]);

  //-----------

  return (
    <ButtonComponent
      size={buttonSizes.small}
      styleType={buttonStyleTypes.transparentWithBorder}
      disabled={!deleteNoteButtonsValidationResponseObj.deleteNote.status}
      tooltipTitle={deleteNoteButtonsValidationResponseObj.deleteNote.msg}
      onClickAction={deleteNoteHandler}
    >
      Delete
    </ButtonComponent>
  );
};

export default DeleteNoteFeature;
