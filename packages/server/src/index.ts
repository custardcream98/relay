// packages/server/src/index.ts

import { app } from "./dashboard/hono";
import { addClient, removeClient } from "./dashboard/websocket";
import { createMcpServer, startMcpServer } from "./mcp";

// MCP는 stdin을 파이프로 연결하므로 TTY이면 수동 실행으로 간주하고 종료
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
// 포트 충돌 시 MCP stdio 서버는 계속 실행 (graceful degradation)
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
      },
      close(ws) {
        removeClient(ws);
      },
      message() {}, // Client-to-server messages are unused for now
    },
  });
  console.error(`[relay] dashboard: http://localhost:${DASHBOARD_PORT}`);
} catch (_err) {
  // 포트가 이미 사용 중이면 경고만 출력하고 MCP 서버는 계속 시작
  console.error(
    `[relay] dashboard port ${DASHBOARD_PORT} already in use — skipping dashboard, MCP server will still start`
  );
}

// MCP server (stdio)
const server = createMcpServer();
await startMcpServer(server);
