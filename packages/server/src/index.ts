// packages/server/src/index.ts
// Entry point: orchestrates MCP stdio server + dashboard HTTP/WebSocket server.
import { WebSocketServer } from "ws";

import { applyCliArgs, parseArgs } from "./cli.js";
import { setPort } from "./config.js";
import { tryServe } from "./dashboard/serve.js";
import { buildSessionSnapshot } from "./dashboard/snapshot.js";
import { isLocalhostOrigin } from "./dashboard/utils.js";
import { addClient, markClientAlive, removeClient, startHeartbeat } from "./dashboard/websocket.js";
import { createMcpServer, startMcpServer } from "./mcp.js";
import { resolvePort } from "./port.js";

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

// Parse and apply CLI args before any module reads env vars
const cliArgs = parseArgs(process.argv.slice(2));
applyCliArgs(cliArgs);

const initialPort = await resolvePort(cliArgs);
const dashResult = await tryServe(initialPort);

if (dashResult) {
  const { server: dashboardServer, port: confirmedPort } = dashResult;
  setPort(confirmedPort);

  // WebSocket server — handles /ws upgrade requests
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  dashboardServer.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    if (origin && !isLocalhostOrigin(origin)) {
      socket.destroy();
      return;
    }

    const url = new URL(request.url ?? "/", `http://localhost:${confirmedPort}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      if (!addClient(ws)) {
        ws.close(1013, "too many clients");
        return;
      }
      markClientAlive(ws);
      ws.on("pong", () => markClientAlive(ws));
      ws.on("close", () => removeClient(ws));
      try {
        ws.send(buildSessionSnapshot(confirmedPort));
      } catch (err) {
        console.error("[relay] failed to send session snapshot:", err);
      }
    });
  });

  startHeartbeat();
} else {
  setPort(null);
}

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
