// packages/dashboard/vite.config.ts

import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@custardcream/relay-shared": resolve(__dirname, "../shared/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3456",
      "/ws": { target: "ws://localhost:3456", ws: true },
    },
  },
  // Output directory matches DASHBOARD_DIST in packages/server/src/dashboard/hono.ts
  build: { outDir: "dist" },
});
