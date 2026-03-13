// packages/server/src/index.ts

import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
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
    "[relay] relay must be started via Claude Code MCP, not directly.\n" +
      "  Register it with: claude mcp add --scope user relay -- npx -y --package @custardcream/relay relay\n" +
      "  Or for local dev:  claude mcp add relay bun -- run src/index.ts"
  );
  process.exit(1);
}

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT ?? 3456);
const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// Dashboard HTTP + WebSocket server.
// EADDRINUSE is emitted asynchronously on the server's "error" event — not catchable via try/catch.
// If the port is already in use, skip the dashboard but keep the MCP stdio server running (graceful degradation)
const dashboardServer = serve({ fetch: app.fetch, port: DASHBOARD_PORT });

dashboardServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[relay] dashboard port ${DASHBOARD_PORT} already in use — skipping dashboard, MCP server will still start`
    );
  } else {
    console.error("[relay] dashboard server error:", err);
  }
});

dashboardServer.on("listening", () => {
  console.error(`[relay] dashboard: http://localhost:${DASHBOARD_PORT}`);
});

// WebSocket server — handles /ws upgrade requests
const wss = new WebSocketServer({ noServer: true });

dashboardServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://localhost:${DASHBOARD_PORT}`);
  if (url.pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      addClient(ws);
      ws.on("close", () => removeClient(ws));
      // Send current session snapshot on new connection — for dashboard initial hydration
      try {
        const db = getDb();
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
    });
  }
});

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
