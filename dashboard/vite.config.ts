// dashboard/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // relay/shared/ 를 @shared 로 참조 — 서버-대시보드 공유 타입 접근
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3456",
      "/ws": { target: "ws://localhost:3456", ws: true },
    },
  },
  build: { outDir: "dist" }, // → relay/dashboard/dist (hono.ts의 DASHBOARD_DIST와 일치)
});
