/// <reference types="vitest" />

// eslint-disable-next-line import/no-unresolved
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { ViteDevServer } from "vite";
import svgr from "vite-plugin-svgr";
import { printAppLogo } from "./scripts/branding.js";

// --- Custom Plugin Definition ---
function customServerMessagePlugin() {
  return {
    name: "custom-server-message",
    configureServer(server: ViteDevServer) {
      server.httpServer?.once("listening", () => setTimeout(() => printAppLogo(), 100));
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    customServerMessagePlugin(),
    {
      name: "full-reload-api",
      handleHotUpdate({ file, server }: { file: string; server: ViteDevServer }) {
        if (file.includes("/api/") || file.includes("\api\\")) {
          server.ws.send({ type: "full-reload" });
          return [];
        }
        return undefined;
      }
    }
  ],
  server: {
    open: true,
    host: "0.0.0.0",
    port: 3000
  },
  build: {
    assetsDir: "static",
    // Pinned explicitly so the JS syntax floor is deterministic and does not shift with Vite's
    // floating default (safe: browserslist targets last-2 evergreen).
    target: "es2022"
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts"
  },
  css: {
    preprocessorOptions: {
      scss: {
        // eslint-disable-next-line quotes
        additionalData: `@use "/src/resources/styles/callers/toolingCaller.scss" as *;`
      }
    }
  }
});
