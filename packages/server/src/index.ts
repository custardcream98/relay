// packages/server/src/index.ts

import { createServer } from "node:net";
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

// --- CLI arg parsing (minimal, no deps) ---
// Supports: --port <number>  --session <id>
function parseArgs(argv: string[]): { port?: number; session?: string } {
  const result: { port?: number; session?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" && argv[i + 1]) {
      const p = Number(argv[i + 1]);
      if (!Number.isNaN(p)) result.port = p;
      i++;
    } else if (argv[i] === "--session" && argv[i + 1]) {
      result.session = argv[i + 1];
      i++;
    }
  }
  return result;
}

const cliArgs = parseArgs(process.argv.slice(2));

// Apply --session CLI arg to env before any module reads RELAY_INSTANCE
if (cliArgs.session) {
  process.env.RELAY_INSTANCE = cliArgs.session;
}

// --- Port resolution with auto-selection ---
// Priority: --port CLI arg → DASHBOARD_PORT env var → auto-select starting at 3456
const PORT_AUTO_START = 3456;
const PORT_AUTO_END = 3465;

/** Returns true if the given TCP port is available (not in use). */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/** Finds an available port in the range [start, end]. Returns null if all are occupied. */
async function findAvailablePort(start: number, end: number): Promise<number | null> {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

async function resolvePort(): Promise<number> {
  // CLI arg takes highest priority
  if (cliArgs.port) return cliArgs.port;
  // Explicit env var — use it as-is (caller owns the choice)
  if (process.env.DASHBOARD_PORT) return Number(process.env.DASHBOARD_PORT);
  // Auto-select from pool
  const found = await findAvailablePort(PORT_AUTO_START, PORT_AUTO_END);
  if (found === null) {
    console.error(
      `[relay] no available port found in range ${PORT_AUTO_START}-${PORT_AUTO_END} — falling back to ${PORT_AUTO_START}`
    );
    return PORT_AUTO_START;
  }
  return found;
}

const DASHBOARD_PORT = await resolvePort();
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
