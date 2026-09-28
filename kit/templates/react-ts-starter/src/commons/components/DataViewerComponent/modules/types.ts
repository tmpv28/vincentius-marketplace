import React, { ReactNode } from "react";

export interface DataViewerColumnDefinitionType<T> {
  id: string;
  label: string;
  // Takes a named bag like rowActionsHandler, so adding an argument never reorders a call site.
  renderCell: (attrbs: { rowData: T }) => ReactNode;
}

export interface DataViewerComponentType<T> {
  rowsData?: T[];
  columnsDefinition?: DataViewerColumnDefinitionType<T>[];
  getRowId: (rowData: T) => string;

  isLoading?: boolean;
  errorMsg?: string;
  noRowsReturnMsg?: string;
  hideNoRowsReturnMsg?: boolean;

  // Rendered in a trailing cell on every row. Takes a named bag, never positional arguments.
  rowActionsHandler?: (attrbs: { rowData: T }) => ReactNode;

  // Grid track sizes for one row, so the owning feature decides its own column widths.
  gridTemplateColumns?: string;

  customClassNames?: {
    rootContainer?: string;
    headRow?: string;
    headCell?: string;
    row?: string;
    cell?: string;
    actionsCell?: string;
  };
  styleConfigs?: React.CSSProperties;
}
