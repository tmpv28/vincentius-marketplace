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

interface InterpolateEndpointUrlType {
  url: string;
  params?: Record<string, string | number>;
}

// The one place a {param} placeholder from an endpointsDefinition becomes a value. Encoded, so an
// id holding a slash or a space stays one path segment. A missing param throws instead of sending
// "/notes/{id}" or "/notes/", which would reach the wrong route: that is a bug in the caller, not
// a response to handle.
export const interpolateEndpointUrl = ({ url, params = {} }: InterpolateEndpointUrlType): string =>
  url.replace(/\{(\w+)\}/g, (_placeholder, paramName: string) => {
    const paramValue = params[paramName];
    if (isNullOrEmpty(paramValue))
      throw new Error(`interpolateEndpointUrl: "${paramName}" is required by ${url}.`);
    return encodeURIComponent(String(paramValue));
  });

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
