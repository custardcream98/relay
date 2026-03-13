// src/index.ts

import { app } from "./dashboard/hono";
import { addClient, removeClient } from "./dashboard/websocket";
import { createMcpServer, startMcpServer } from "./mcp";

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT ?? 3456);

// 대시보드 HTTP + WebSocket 서버
// Bun WebSocket은 fetch 핸들러에서 직접 server.upgrade()를 호출해야 작동함
Bun.serve({
  port: DASHBOARD_PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    // /ws 경로는 WebSocket 업그레이드 처리
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      addClient(ws);
    },
    close(ws) {
      removeClient(ws);
    },
    message() {}, // 클라이언트 → 서버 메시지는 현재 미사용
  },
});

console.error(`[relay] 대시보드: http://localhost:${DASHBOARD_PORT}`);

// MCP 서버 (stdio)
const server = createMcpServer();
await startMcpServer(server);
