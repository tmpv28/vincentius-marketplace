import React, { ReactNode } from "react";

export interface DataViewerColumnDefinitionType<TRowDataType> {
  id: string;
  label: string;
  renderCell: (rowData: TRowDataType) => ReactNode;
}

export interface DataViewerComponentType<TRowDataType> {
  rowsData?: TRowDataType[];
  columnsDefinition?: DataViewerColumnDefinitionType<TRowDataType>[];
  getRowId: (rowData: TRowDataType) => string;

  isLoading?: boolean;
  noRowsReturnMsg?: string;
  hideNoRowsReturnMsg?: boolean;

  // Rendered in a trailing cell on every row. Takes a named bag, never positional arguments.
  rowActionsHandler?: (attrbs: { rowData: TRowDataType }) => ReactNode;

  // Grid track sizes for one row, so the owning feature decides its own column widths.
  gridTemplateColumns?: string;

  customClassNames?: {
    rootContainer?: string;
    headRow?: string;
    headCell?: string;
    row?: string;
    cell?: string;
  };
  styleConfigs?: React.CSSProperties;
}
