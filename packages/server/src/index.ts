// packages/server/src/index.ts

import { app } from "./dashboard/hono";
import { addClient, removeClient } from "./dashboard/websocket";
import { getDb } from "./db/client";
import { getAllArtifacts } from "./db/queries/artifacts";
import { getAllMessages } from "./db/queries/messages";
import { getAllTasks } from "./db/queries/tasks";
import { createMcpServer, startMcpServer } from "./mcp";

// MCP connects via piped stdin — if stdin is a TTY, this is a manual invocation; exit with guidance
if (process.stdin.isTTY) {
  console.error(
    "[relay] relay-server must be started via Claude Code MCP, not directly.\n" +
      "  Register it with: claude mcp add --npm @custardcream/relay relay-server\n" +
      "  Or for local dev:  claude mcp add relay bun -- run src/index.ts"
  );
  process.exit(1);
}

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT ?? 3456);

// Dashboard HTTP + WebSocket server.
// Bun WebSocket requires server.upgrade() to be called directly inside the fetch handler.
// If the port is already in use, skip the dashboard but keep the MCP stdio server running (graceful degradation)
try {
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
        // 신규 연결 시 현재 세션 스냅샷 전송 — 대시보드 초기 하이드레이션용
        try {
          const db = getDb();
          const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";
          const snapshot = JSON.stringify({
            type: "session:snapshot",
            tasks: getAllTasks(db, SESSION_ID),
            messages: getAllMessages(db, SESSION_ID),
            artifacts: getAllArtifacts(db, SESSION_ID),
            timestamp: Date.now(),
          });
          ws.send(snapshot);
        } catch (err) {
          console.error("[relay] failed to send session snapshot:", err);
        }
      },
      close(ws) {
        removeClient(ws);
      },
      message() {}, // Client-to-server messages are unused for now
    },
  });
  console.error(`[relay] dashboard: http://localhost:${DASHBOARD_PORT}`);
} catch (_err) {
  // Port already in use — warn and continue; MCP server will still start
  console.error(
    `[relay] dashboard port ${DASHBOARD_PORT} already in use — skipping dashboard, MCP server will still start`
  );
}

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
