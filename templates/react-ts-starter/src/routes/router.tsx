import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route
} from "react-router-dom";

import ToastsControllerComponent from "../commons/components/ToastsControllerComponent/ToastsControllerComponent";
import ToastContext from "../commons/contexts/Toast/ToastContext";

import { ROUTES_CONFIGS as routesConfigs } from "./modules/routesConfigsDefinition";
import { BASE_ROUTE_URLS as routeUrls } from "./modules/baseRouteUrlsDefinition";

// Providers are nested explicitly here and nowhere else. The order is load-bearing information
// about which context can consume which, and a compose helper would hide exactly that.
const AppContextLayout: React.FC = () => (
  <ToastContext>
    <Outlet />

    <ToastsControllerComponent />
  </ToastContext>
);

export const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppContextLayout />}>
      {Object.values(routesConfigs).map((routeInstance) => (
        <Route
          key={`Route_${routeInstance.path}`}
          path={routeInstance.path}
          element={routeInstance.element}
        />
      ))}

      <Route path="*" element={<Navigate to={routeUrls.notes} replace />} />
    </Route>
  )
);
