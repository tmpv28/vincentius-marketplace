import { DefaultEndpointHandlingType } from "../../../configs/modules/sharedTypes";

// Adds attributes on top of the default handling, so it earns a named interface.
export interface ReadNotesEndpointType extends DefaultEndpointHandlingType {
  isFetchEnabled?: boolean;
}
