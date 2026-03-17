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
import { createMcpServer, startMcpServer } from "./mcp";
import { getAllArtifacts, getAllMessages, getAllTasks } from "./store";
import { taskToPayload } from "./utils/broadcast";

// MCP connects via piped stdin — if stdin is a TTY, this is a manual invocation; exit with guidance
if (process.stdin.isTTY) {
  console.error(
    "[relay] relay must be started via Claude Code MCP, not directly.\n" +
      "  Install the plugin inside Claude Code:\n" +
      "    /plugin marketplace add custardcream98/relay\n" +
      "    /plugin install relay@relay\n" +
      "  Or for local dev:\n" +
      "    claude mcp add relay bun -- run src/index.ts"
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
    // No hostname — binds on all interfaces (same as @hono/node-server's serve()),
    // so the check accurately reflects whether serve() will succeed.
    server.listen(port);
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

const initialPort = await resolvePort();

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
    tasks: getAllTasks(sessionId).map(taskToPayload),
    messages: getAllMessages(sessionId).map(({ session_id: _s, seq: _q, ...m }) => ({
      ...m,
      metadata: m.metadata ?? null,
    })),
    artifacts: getAllArtifacts(sessionId).map(
      ({ session_id: _s, content: _c, task_id: _t, created_at: _ca, ...a }) => a
    ),
    instanceId: process.env.RELAY_INSTANCE,
    port,
    agents: agentMeta,
    timestamp: Date.now(),
  };

  return JSON.stringify(snapshot);
}

// Dashboard HTTP + WebSocket server.
// tryServe() awaits the "listening" event before resolving, so the port is guaranteed bound on success.
// On EADDRINUSE, it retries with the next available port in the auto-select range.
// Returns null when no port can be bound — MCP stdio server still runs (graceful degradation).
type DashboardResult = { server: ReturnType<typeof serve>; port: number } | null;

async function tryServe(port: number): Promise<DashboardResult> {
  return new Promise((resolve) => {
    const srv = serve({ fetch: app.fetch, port });
    srv.once("error", async (err: NodeJS.ErrnoException) => {
      srv.close(); // Release the failed server instance before retry or bail
      if (err.code === "EADDRINUSE") {
        // Port was occupied — try next available port in the auto-select range
        const next = await findAvailablePort(port + 1, PORT_AUTO_END);
        if (next !== null) {
          resolve(await tryServe(next));
        } else {
          console.error(
            `[relay] no available port in ${PORT_AUTO_START}-${PORT_AUTO_END} — dashboard unavailable, MCP server will still start.`
          );
          resolve(null);
        }
      } else {
        console.error("[relay] dashboard server error:", err);
        resolve(null);
      }
    });
    srv.once("listening", () => {
      console.error(`[relay] dashboard: http://localhost:${port}`);
      resolve({ server: srv, port });
    });
  });
}

const dashResult = await tryServe(initialPort);

if (dashResult) {
  const { server: dashboardServer, port: confirmedPort } = dashResult;
  setPort(confirmedPort);

  // WebSocket server — handles /ws upgrade requests
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  dashboardServer.on("upgrade", (request, socket, head) => {
    // Reject WebSocket upgrades from non-localhost origins.
    // isLocalhostOrigin() returns false for malformed origins, so one check covers both cases.
    const origin = request.headers.origin;
    if (origin && !isLocalhostOrigin(origin)) {
      socket.destroy();
      return;
    }

    const url = new URL(request.url ?? "/", `http://localhost:${confirmedPort}`);
    if (url.pathname !== "/ws") {
      // Reject WebSocket upgrade requests targeting any path other than /ws.
      // Leaving the socket open without handling it would leak a half-open TCP connection.
      socket.destroy();
      return;
    }
    // pathname === "/ws" is guaranteed here by the early-return above
    wss.handleUpgrade(request, socket, head, (ws) => {
      if (!addClient(ws)) {
        // Reject connection when the client cap is reached to prevent unbounded memory growth
        ws.close(1013, "too many clients");
        return;
      }
      markClientAlive(ws);
      // Mark client as alive when it responds to a ping
      ws.on("pong", () => markClientAlive(ws));
      ws.on("close", () => removeClient(ws));
      // Send current session snapshot on new connection — for dashboard initial hydration
      try {
        ws.send(buildSessionSnapshot(confirmedPort));
      } catch (err) {
        console.error("[relay] failed to send session snapshot:", err);
      }
    });
  });

  // Start WebSocket ping/pong heartbeat so the dashboard can detect stale connections
  startHeartbeat();
} else {
  // Dashboard unavailable — MCP stdio server still runs
  setPort(null);
}

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
