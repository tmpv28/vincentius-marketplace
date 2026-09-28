import React, { useCallback, useState } from "react";

import DataViewerComponent from "../../../commons/components/DataViewerComponent/DataViewerComponent";
import DeleteNoteFeature from "../DeleteNote/DeleteNoteFeature";
import AddNoteFeature from "../AddNote/AddNoteFeature";

import { API_NoteType } from "../../../api/queries/notes/entityTypes";

import { MANAGE_NOTES_DEMO_SEED_DEFINITION as demoNotesSeed } from "./modules/constants/demoNotesDefinition";
import { MANAGE_NOTES_COLUMNS_DEFINITION as notesColumns } from "./modules/constants/columnsDefinition";
import { MANAGE_NOTES_GRID_TEMPLATE_COLUMNS as notesGridColumns } from "./modules/constants";
import { ManageNotesFeatureType } from "./modules/types";
import "./ManageNotesFeature.scss";

const ManageNotesFeature: React.FC<ManageNotesFeatureType> = ({
  isLoading = false,
  errorMsg = "",
  noRowsReturnMsg = "No notes yet. Add the first one."
}: ManageNotesFeatureType) => {
  // Demo state. The API layer under api/queries/notes is the scaffold to switch to once a
  // backend exists; nothing here fakes a request.
  const [notes, setNotes] = useState<API_NoteType[]>(demoNotesSeed);

  //-----------

  const addNoteToListHandler = useCallback((addedNote: API_NoteType) => {
    setNotes((prevNotes) => [addedNote, ...prevNotes]);
  }, []);

  const removeNoteFromListHandler = useCallback((deletedNote: API_NoteType) => {
    setNotes((prevNotes) => prevNotes.filter((prevNote) => prevNote.id !== deletedNote.id));
  }, []);

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
        errorMsg={errorMsg}
        noRowsReturnMsg={noRowsReturnMsg}
        gridTemplateColumns={notesGridColumns}
        rowActionsHandler={({ rowData }) => (
          <DeleteNoteFeature noteData={rowData} onNoteDeletedHandler={removeNoteFromListHandler} />
        )}
      />
    </section>
  );
};

export default ManageNotesFeature;
