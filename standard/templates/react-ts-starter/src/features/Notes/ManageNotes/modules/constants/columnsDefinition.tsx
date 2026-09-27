import { formatDateForDisplay } from "../../../../../commons/utils/formatting/dateFormatting";

import { NoteColumnDefinitionType } from "../types";

// The list is a table described as data, so adding a column is an entry here and nothing else.
export const MANAGE_NOTES_COLUMNS_DEFINITION: NoteColumnDefinitionType[] = [
  {
    id: "title",
    label: "Title",
    renderCell: (noteInstance) => (
      <span className="ManageNotesFeature__cellText ManageNotesFeature__cellText--title">
        {noteInstance.title}
      </span>
    )
  },
  {
    id: "body",
    label: "Body",
    renderCell: (noteInstance) => (
      <span className="ManageNotesFeature__cellText">{noteInstance.body}</span>
    )
  },
  {
    id: "createdAt",
    label: "Created",
    renderCell: (noteInstance) => (
      <span className="ManageNotesFeature__cellText ManageNotesFeature__cellText--muted">
        {formatDateForDisplay(noteInstance.createdAt)}
      </span>
    )
  }
];
