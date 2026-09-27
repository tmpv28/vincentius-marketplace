import { isNullOrEmpty } from "../../../commons/utils/typeChecks/isNullOrEmpty";

interface TreatEntityNameForApiCallType {
  defaultEntityName: string;
  entityNameOptions?: { name?: string };
}

// Prefers the instance's own name in user-facing messages, falls back to the generic entity label.
export const treatEntityNameForApiCall = ({
  defaultEntityName,
  entityNameOptions
}: TreatEntityNameForApiCallType): string =>
  isNullOrEmpty(entityNameOptions?.name) ? defaultEntityName : (entityNameOptions?.name as string);

interface GetRequiredFieldUndefinedErrorMsgType {
  actionType: string;
  entityName: string;
  fieldName: string;
  customReason?: string;
}

export const getRequiredFieldUndefinedErrorMsg = ({
  actionType,
  entityName,
  fieldName,
  customReason
}: GetRequiredFieldUndefinedErrorMsgType): string =>
  isNullOrEmpty(customReason)
    ? `Could not ${actionType} ${entityName}: "${fieldName}" is required.`
    : `Could not ${actionType} ${entityName}: ${customReason}`;
