import { DataViewerColumnDefinitionType } from "../../../../commons/components/DataViewerComponent/modules/types";
import { API_NoteType } from "../../../../api/queries/notes/entityTypes";

export interface ManageNotesFeatureType {
  isLoading?: boolean;
  noRowsReturnMsg?: string;
}

export type NoteColumnDefinitionType = DataViewerColumnDefinitionType<API_NoteType>;
