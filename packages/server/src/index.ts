// packages/server/src/index.ts

import { app } from "./dashboard/hono";
import { addClient, removeClient } from "./dashboard/websocket";
import { createMcpServer, startMcpServer } from "./mcp";

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT ?? 3456);

// Dashboard HTTP + WebSocket server.
// Bun WebSocket requires server.upgrade() to be called directly inside the fetch handler.
Bun.serve({
  port: DASHBOARD_PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    // Handle WebSocket upgrade for the /ws path
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
    message() {}, // Client-to-server messages are unused for now
  },
});

console.error(`[relay] dashboard: http://localhost:${DASHBOARD_PORT}`);

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
