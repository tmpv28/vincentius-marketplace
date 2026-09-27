import React, { useCallback, useState } from "react";

import GenericModalComponent from "../../../commons/components/GenericModalComponent/GenericModalComponent";
import ButtonComponent from "../../../commons/components/ButtonComponent/ButtonComponent";
import InputComponent from "../../../commons/components/InputComponent/InputComponent";

import { BUTTON_COMPONENT_STYLE_TYPES as buttonStyleTypes } from "../../../commons/components/ButtonComponent/modules/constants";
import { useToastActionsContext } from "../../../commons/contexts/Toast/modules/ToastContext.context";
import { ReturnEventType } from "../../../commons/types/generic";
import { emptyOnClick } from "../../../commons/constants/shared";

import { API_AddNoteType } from "../../../api/queries/notes/create/endpointTypes";

import { ADD_NOTE_FEATURE_DEFAULT_VALUES as noteDefaultValues } from "./modules/constants";
import useAddNoteValidations from "./modules/addNoteValidations";
import { AddNoteFeatureType } from "./modules/types";
import "./AddNoteFeature.scss";

const AddNoteFeature: React.FC<AddNoteFeatureType> = ({
  onNoteAddedHandler = emptyOnClick
}: AddNoteFeatureType) => {
  const [noteData, setNoteData] = useState<API_AddNoteType>(noteDefaultValues);
  const { createSuccessfulToast } = useToastActionsContext();

  const { addNoteButtonsValidationResponseObj } = useAddNoteValidations({ noteData });
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState<boolean>(false);

  //-----------

  const handleNoteValueChange = (event: ReturnEventType) => {
    const { name, value } = event.target;
    setNoteData((preState) => ({
      ...preState,
      [name]: value
    }));
  };

  const closeAddNoteModal = useCallback(() => {
    setNoteData(noteDefaultValues);
    setIsAddNoteModalOpen(false);
  }, []);

  // The demo appends locally. useAddNote in api/queries/notes/create is the call to swap this
  // body for once a backend exists.
  const addNoteHandler = useCallback(() => {
    if (!addNoteButtonsValidationResponseObj.saveChanges.status) return;

    onNoteAddedHandler({
      id: `Note_${Date.now()}`,
      title: noteData.title,
      body: noteData.body,
      createdAt: new Date().toISOString()
    });

    createSuccessfulToast(`${noteData.title} added successfully.`);
    closeAddNoteModal();
  }, [
    addNoteButtonsValidationResponseObj.saveChanges,
    onNoteAddedHandler,
    createSuccessfulToast,
    closeAddNoteModal,
    noteData
  ]);

  //-----------

  return (
    <div className="AddNoteFeature">
      <ButtonComponent
        styleType={buttonStyleTypes.accent}
        disabled={!addNoteButtonsValidationResponseObj.actionTrigger.status}
        tooltipTitle={addNoteButtonsValidationResponseObj.actionTrigger.msg}
        onClickAction={() => setIsAddNoteModalOpen(true)}
      >
        Add note
      </ButtonComponent>

      <GenericModalComponent
        title="Add note"
        subtitle="A note needs a title; the body is optional."
        isGenericModalOpen={isAddNoteModalOpen}
        onClose={closeAddNoteModal}
        confirmationButtonConfig={{
          label: "Save note",
          onClickAction: addNoteHandler,
          disabled: !addNoteButtonsValidationResponseObj.saveChanges.status,
          tooltipTitle: addNoteButtonsValidationResponseObj.saveChanges.msg
        }}
        cancelationButtonConfig={{ label: "Cancel", onClickAction: closeAddNoteModal }}
      >
        <InputComponent
          label="Title"
          name="title"
          value={noteData.title}
          placeholder="What is this note about?"
          autoFocus
          onChange={handleNoteValueChange}
        />

        <InputComponent
          label="Body"
          name="body"
          value={noteData.body}
          placeholder="Anything worth remembering."
          isMultiline
          onChange={handleNoteValueChange}
        />
      </GenericModalComponent>
    </div>
  );
};

export default AddNoteFeature;
