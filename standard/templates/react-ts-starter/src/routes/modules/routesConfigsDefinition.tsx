import NotesPage from "../../pages/NotesPage/NotesPage";

import { BASE_ROUTE_URLS as routeUrls } from "./baseRouteUrlsDefinition";
import { RouteConfigType } from "./types";

// The route table is data: adding a page is one entry here, never an edit inside the router.
export const ROUTES_CONFIGS: Record<string, RouteConfigType> = {
  notes: { path: routeUrls.notes, element: <NotesPage /> }
};
