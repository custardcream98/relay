// packages/server/src/index.ts

import { createServer } from "node:net";
import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { loadPool } from "./agents/loader";
import { getSessionId, setPort } from "./config";
import { app } from "./dashboard/hono";
import { isLocalhostOrigin } from "./dashboard/utils";
import { addClient, markClientAlive, removeClient, startHeartbeat } from "./dashboard/websocket";
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
// Supports: --port <number>  --instance <id>
function parseArgs(argv: string[]): { port?: number; instance?: string } {
  const result: { port?: number; instance?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" && argv[i + 1]) {
      const p = Number(argv[i + 1]);
      if (!Number.isNaN(p)) result.port = p;
      i++;
    } else if (argv[i] === "--instance" && argv[i + 1]) {
      result.instance = argv[i + 1];
      i++;
    }
  }
  return result;
}

const cliArgs = parseArgs(process.argv.slice(2));

// Validate --instance value: only alphanumeric, hyphen, underscore allowed
// Prevents DB path traversal via RELAY_INSTANCE (e.g. "../../tmp/malicious")
if (cliArgs.instance && !/^[a-zA-Z0-9_-]+$/.test(cliArgs.instance)) {
  console.error("[relay] invalid --instance value; use alphanumeric, hyphen, underscore only");
  process.exit(1);
}

// Apply --instance CLI arg to env before any module reads RELAY_INSTANCE
if (cliArgs.instance) {
  process.env.RELAY_INSTANCE = cliArgs.instance;
}

// Validate RELAY_INSTANCE env var as well (set directly without --instance flag)
if (process.env.RELAY_INSTANCE && !/^[a-zA-Z0-9_-]+$/.test(process.env.RELAY_INSTANCE)) {
  console.error("[relay] invalid RELAY_INSTANCE value; use alphanumeric, hyphen, underscore only");
  process.exit(1);
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
  // Explicit env var — validate and use it (caller owns the choice)
  if (process.env.DASHBOARD_PORT) {
    const p = Number(process.env.DASHBOARD_PORT);
    if (!Number.isNaN(p) && p > 0 && p <= 65535) return p;
    console.error(
      `[relay] invalid DASHBOARD_PORT "${process.env.DASHBOARD_PORT}" — falling back to auto-select`
    );
  }
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
setPort(DASHBOARD_PORT);

/**
 * Build a session:snapshot event payload serialized to JSON.
 * Used to hydrate the dashboard on initial WebSocket connection.
 * Typed as Extract<RelayEvent, { type: "session:snapshot" }> to catch payload shape drift at compile time.
 */
function buildSessionSnapshot(port: number): string {
  const sessionId = getSessionId();

  // Load agent metadata for SessionTeamBadge hydration
  let agentMeta: Array<{ id: AgentId; name: string; emoji: string }> = [];
  try {
    const agents = loadPool();
    agentMeta = Object.values(agents).map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
    }));
  } catch {
    // Agent loading failure should not block snapshot delivery
  }

  const snapshot: Extract<RelayEvent, { type: "session:snapshot" }> = {
    type: "session:snapshot",
    sessionId,
    tasks: getAllTasks(sessionId),
    messages: getAllMessages(sessionId).map((m) => ({ ...m, metadata: m.metadata ?? null })),
    artifacts: getAllArtifacts(sessionId),
    instanceId: process.env.RELAY_INSTANCE,
    port,
    agents: agentMeta,
    timestamp: Date.now(),
  };

  return JSON.stringify(snapshot);
}

// Dashboard HTTP + WebSocket server.
// EADDRINUSE is emitted asynchronously on the server's "error" event — not catchable via try/catch.
// If the port is already in use, skip the dashboard but keep the MCP stdio server running (graceful degradation)
const dashboardServer = serve({ fetch: app.fetch, port: DASHBOARD_PORT });

dashboardServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    // Port is occupied — clear the port so get_server_info reports no dashboard URL
    // instead of pointing agents at a server that belongs to another instance.
    setPort(null);
    console.error(
      `[relay] dashboard port ${DASHBOARD_PORT} already in use — dashboard unavailable, MCP server will still start.\n` +
        `  To fix: set a unique DASHBOARD_PORT for each relay instance in .mcp.json.\n` +
        `  Example: DASHBOARD_PORT=3457 for a second instance.`
    );
  } else {
    console.error("[relay] dashboard server error:", err);
  }
});

dashboardServer.on("listening", () => {
  console.error(`[relay] dashboard: http://localhost:${DASHBOARD_PORT}`);
});

// WebSocket server — handles /ws upgrade requests
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

dashboardServer.on("upgrade", (request, socket, head) => {
  // Reject WebSocket upgrades from non-localhost origins.
  // This prevents arbitrary web pages from subscribing to all real-time events.
  const origin = request.headers.origin;
  // Reject WebSocket upgrades from non-localhost origins.
  // isLocalhostOrigin() returns false for malformed origins, so one check covers both cases.
  if (origin && !isLocalhostOrigin(origin)) {
    socket.destroy();
    return;
  }

  const url = new URL(request.url ?? "/", `http://localhost:${DASHBOARD_PORT}`);
  if (url.pathname !== "/ws") {
    // Reject WebSocket upgrade requests targeting any path other than /ws.
    // Leaving the socket open without handling it would leak a half-open TCP connection.
    socket.destroy();
    return;
  }
  // pathname === "/ws" is guaranteed here by the early-return above
  wss.handleUpgrade(request, socket, head, (ws) => {
    addClient(ws);
    markClientAlive(ws);
    // Mark client as alive when it responds to a ping
    ws.on("pong", () => markClientAlive(ws));
    ws.on("close", () => removeClient(ws));
    // Send current session snapshot on new connection — for dashboard initial hydration
    try {
      ws.send(buildSessionSnapshot(DASHBOARD_PORT));
    } catch (err) {
      console.error("[relay] failed to send session snapshot:", err);
    }
  });
});

// Start WebSocket ping/pong heartbeat so the dashboard can detect stale connections
startHeartbeat();

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
