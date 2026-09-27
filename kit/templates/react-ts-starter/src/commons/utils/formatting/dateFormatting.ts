import { format, isValid, parseISO } from "date-fns";

import { isNullOrEmpty } from "../typeChecks/isNullOrEmpty";

// Centralised so the same timestamp never ends up formatted two ways in two lists.
export const formatDateForDisplay = (isoDate?: string): string => {
  if (isNullOrEmpty(isoDate)) return "";

  const parsedDate = parseISO(isoDate as string);
  if (!isValid(parsedDate)) return "";

  return format(parsedDate, "dd MMM yyyy, HH:mm");
};
