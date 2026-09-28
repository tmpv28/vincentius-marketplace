import { NaNDateType } from "../../types/generic";
import {
  isArray,
  isBoolean,
  isDate,
  isNumber,
  isPlainObject,
  isString,
  isUndefined
} from "./isSpecificType";

type NonBooleanValueType = string | number | object | symbol | bigint | null | undefined;

/**
 * @param value Value to be verified.
 * @returns *true* if it is null, undefined, blank, or an empty container.
 */
export function isNullOrEmpty(
  value: NonBooleanValueType
): value is null | undefined | "" | [] | Record<string, never> | NaNDateType {
  if (value === null || isUndefined(value)) return true;

  if (isNumber(value) || isBoolean(value)) return false;

  if (isString(value) && /^\s*$/.test(value)) return true;

  if (isDate(value) && Number.isNaN(value.getTime())) return true;

  if (isArray(value) && value.length === 0) return true;

  if (isPlainObject(value) && Object.keys(value).length === 0) return true;

  return false;
}
