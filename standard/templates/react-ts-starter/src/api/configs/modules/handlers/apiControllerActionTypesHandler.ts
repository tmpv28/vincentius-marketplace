import { ApiControllerActionType } from "../sharedTypes";

export const API_CONTROLLER_ACTION_TYPES = {
  create: { name: "create", verb: "added" },
  read: { name: "read", verb: "loaded" },
  update: { name: "update", verb: "updated" },
  delete: { name: "delete", verb: "deleted" }
} as const satisfies Record<string, ApiControllerActionType>;
