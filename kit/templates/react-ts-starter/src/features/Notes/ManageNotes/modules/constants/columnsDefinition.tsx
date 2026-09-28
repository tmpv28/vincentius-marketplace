import { formatDateForDisplay } from "../../../../../commons/utils/formatting/dateFormatting";

import { NoteColumnDefinitionType } from "../types";

// The list is a table described as data, so adding a column is an entry here and nothing else.
export const MANAGE_NOTES_COLUMNS_DEFINITION: NoteColumnDefinitionType[] = [
  {
    id: "title",
    label: "Title",
    renderCell: ({ rowData }) => (
      <span className="ManageNotesFeature__cellText ManageNotesFeature__cellText--title">
        {rowData.title}
      </span>
    )
  },
  {
    id: "body",
    label: "Body",
    renderCell: ({ rowData }) => (
      <span className="ManageNotesFeature__cellText">{rowData.body}</span>
    )
  },
  {
    id: "createdAt",
    label: "Created",
    renderCell: ({ rowData }) => (
      <span className="ManageNotesFeature__cellText ManageNotesFeature__cellText--muted">
        {formatDateForDisplay(rowData.createdAt)}
      </span>
    )
  }
];
