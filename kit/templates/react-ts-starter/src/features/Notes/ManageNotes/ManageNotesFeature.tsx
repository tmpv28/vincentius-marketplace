import React, { useCallback, useState } from "react";

import DataViewerComponent from "../../../commons/components/DataViewerComponent/DataViewerComponent";
import ButtonComponent from "../../../commons/components/ButtonComponent/ButtonComponent";
import AddNoteFeature from "../AddNote/AddNoteFeature";

import {
  BUTTON_COMPONENT_SIZES as buttonSizes,
  BUTTON_COMPONENT_STYLE_TYPES as buttonStyleTypes
} from "../../../commons/components/ButtonComponent/modules/constants";
import { useToastActionsContext } from "../../../commons/contexts/Toast/modules/ToastContext.context";

import { API_NoteType } from "../../../api/queries/notes/entityTypes";

import { MANAGE_NOTES_DEMO_SEED_DEFINITION as demoNotesSeed } from "./modules/constants/demoNotesDefinition";
import { MANAGE_NOTES_COLUMNS_DEFINITION as notesColumns } from "./modules/constants/columnsDefinition";
import { MANAGE_NOTES_GRID_TEMPLATE_COLUMNS as notesGridColumns } from "./modules/constants";
import { ManageNotesFeatureType } from "./modules/types";
import "./ManageNotesFeature.scss";

const ManageNotesFeature: React.FC<ManageNotesFeatureType> = ({
  isLoading = false,
  noRowsReturnMsg = "No notes yet. Add the first one."
}: ManageNotesFeatureType) => {
  // Demo state. The API layer under api/queries/notes is the scaffold to switch to once a
  // backend exists; nothing here fakes a request.
  const [notes, setNotes] = useState<API_NoteType[]>(demoNotesSeed);
  const { createSuccessfulToast } = useToastActionsContext();

  //-----------

  const addNoteToListHandler = useCallback((addedNote: API_NoteType) => {
    setNotes((prevNotes) => [addedNote, ...prevNotes]);
  }, []);

  const deleteNoteHandler = useCallback(
    (noteInstance: API_NoteType) => {
      setNotes((prevNotes) => prevNotes.filter((prevNote) => prevNote.id !== noteInstance.id));
      createSuccessfulToast(`${noteInstance.title} deleted successfully.`);
    },
    [createSuccessfulToast]
  );

  //-----------

  return (
    <section className="ManageNotesFeature">
      <header className="ManageNotesFeature__header">
        <h2 className="ManageNotesFeature__heading">Notes ({notes.length})</h2>

        <AddNoteFeature onNoteAddedHandler={addNoteToListHandler} />
      </header>

      <DataViewerComponent<API_NoteType>
        rowsData={notes}
        columnsDefinition={notesColumns}
        getRowId={(noteInstance) => noteInstance.id}
        isLoading={isLoading}
        noRowsReturnMsg={noRowsReturnMsg}
        gridTemplateColumns={notesGridColumns}
        rowActionsHandler={({ rowData }) => (
          <ButtonComponent
            size={buttonSizes.small}
            styleType={buttonStyleTypes.transparentWithBorder}
            tooltipTitle={`Delete "${rowData.title}"`}
            onClickAction={() => deleteNoteHandler(rowData)}
          >
            Delete
          </ButtonComponent>
        )}
      />
    </section>
  );
};

export default ManageNotesFeature;
