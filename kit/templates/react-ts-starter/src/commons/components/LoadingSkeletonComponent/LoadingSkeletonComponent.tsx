import React from "react";

import { EMPTY_OBJ } from "../../constants/shared";

import { LoadingSkeletonComponentType } from "./modules/types";
import "./LoadingSkeletonComponent.scss";

const LoadingSkeletonComponent: React.FC<LoadingSkeletonComponentType> = ({
  rowsCount = 3,
  customClassNames = EMPTY_OBJ,
  styleConfigs = EMPTY_OBJ
}: LoadingSkeletonComponentType) => {
  const classNames = {
    rootContainer: `LoadingSkeletonComponent ${customClassNames.rootContainer || ""}`,
    row: `LoadingSkeletonComponent__row ${customClassNames.row || ""}`
  };

  //-----------

  return (
    <div className={classNames.rootContainer} style={styleConfigs}>
      {Array.from({ length: rowsCount }, (_unused, rowIndex) => rowIndex).map((rowInstance) => (
        <span key={`LoadingSkeletonRow_${rowInstance}`} className={classNames.row} />
      ))}
    </div>
  );
};

export default LoadingSkeletonComponent;
