import React, { ReactNode } from "react";

export type OnClickType = (...args: any[]) => void;

export type GenericRowDataType = Record<string, any>;

// Branded so an invalid Date can be named in a signature instead of being described in a comment.
export type NaNDateType = Date & { __invalidDateBrand: true };

export type GuidType = `${string}-${string}-${string}-${string}-${string}`;

export interface GenericProviderType {
  children: ReactNode;
}

export interface ReturnEventType {
  target: {
    name: string;
    value: any;
  };
}

export type GenericComponentType = React.FC<{ id?: string }>;
