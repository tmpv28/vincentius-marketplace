import React from "react";

import LoadingSkeletonComponent from "../LoadingSkeletonComponent/LoadingSkeletonComponent";
import EmptyStateComponent from "../EmptyStateComponent/EmptyStateComponent";

import { isNullOrEmpty } from "../../utils/typeChecks/isNullOrEmpty";
import { EMPTY_ARRAY, EMPTY_OBJ } from "../../constants/shared";

import { DataViewerComponentType } from "./modules/types";
import "./DataViewerComponent.scss";

// Owns the whole tri-state. A feature hands it rows and columns and never branches on loading or
// emptiness itself, which is what stops two lists in the same app growing two different spinners.
const DataViewerComponent = <TRowDataType,>({
  rowsData = EMPTY_ARRAY,
  columnsDefinition = EMPTY_ARRAY,
  getRowId,
  isLoading = false,
  noRowsReturnMsg = "Nothing to show yet.",
  hideNoRowsReturnMsg = false,
  rowActionsHandler,
  gridTemplateColumns = "",
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: DataViewerComponentType<TRowDataType>) => {
  const hasRowActions = rowActionsHandler !== undefined;

  const classNames = {
    rootContainer: `DataViewerComponent ${customClassNames.rootContainer || ""}`,
    headRow: `DataViewerComponent__row DataViewerComponent__row--head ${customClassNames.headRow || ""}`,
    headCell: `DataViewerComponent__headCell ${customClassNames.headCell || ""}`,
    row: `DataViewerComponent__row ${customClassNames.row || ""}`,
    cell: `DataViewerComponent__cell ${customClassNames.cell || ""}`
  };
  const rowStyleConfigs = isNullOrEmpty(gridTemplateColumns) ? EMPTY_OBJ : { gridTemplateColumns };

  //-----------

  if (isLoading)
    return (
      <div className={classNames.rootContainer} style={styleConfigs}>
        <LoadingSkeletonComponent rowsCount={4} />
      </div>
    );

  if (isNullOrEmpty(rowsData))
    return (
      <div className={classNames.rootContainer} style={styleConfigs}>
        {!hideNoRowsReturnMsg && <EmptyStateComponent message={noRowsReturnMsg} />}
      </div>
    );

  return (
    <div className={classNames.rootContainer} style={styleConfigs}>
      <div className={classNames.headRow} style={rowStyleConfigs}>
        {columnsDefinition.map((columnInstance) => (
          <span key={`DataViewerColumn_${columnInstance.id}`} className={classNames.headCell}>
            {columnInstance.label}
          </span>
        ))}

        {hasRowActions && <span className={classNames.headCell} />}
      </div>

      {rowsData.map((rowDataInstance) => (
        <div
          key={`DataViewerRow_${getRowId(rowDataInstance)}`}
          className={classNames.row}
          style={rowStyleConfigs}
        >
          {columnsDefinition.map((columnInstance) => (
            <div
              key={`DataViewerCell_${getRowId(rowDataInstance)}_${columnInstance.id}`}
              className={classNames.cell}
            >
              {columnInstance.renderCell(rowDataInstance)}
            </div>
          ))}

          {hasRowActions && (
            <div className={`${classNames.cell} DataViewerComponent__cell--actions`}>
              {rowActionsHandler({ rowData: rowDataInstance })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DataViewerComponent;
