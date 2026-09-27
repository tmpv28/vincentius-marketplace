import React from "react";
import { RouterProvider } from "react-router-dom";
import { MantineProvider } from "@mantine/core";

import { appRouter } from "./routes/router";
import "@mantine/core/styles.css";

// The UI library is configured once, here, and touched by exactly one wrapper component below.
const App: React.FC = () => (
  <MantineProvider defaultColorScheme="dark">
    <RouterProvider router={appRouter} />
  </MantineProvider>
);

export default App;
