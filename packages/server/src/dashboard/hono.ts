// packages/server/src/dashboard/hono.ts

import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { markAsAgentId } from "@custardcream/relay-shared";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadPool } from "../agents/loader";
import { getRelayDir, getSessionId } from "../config";
import { getDb } from "../db/client";
import { getAllArtifacts } from "../db/queries/artifacts";
import { getEventsBySession } from "../db/queries/events";
import { getAllMessages } from "../db/queries/messages";
import { getAllSessions } from "../db/queries/sessions";
import { getAllTasks } from "../db/queries/tasks";
import { handleGetSessionSummary } from "../tools/sessions";
import { broadcast } from "./websocket";

// Bundled: resolve dashboard/ relative to this file's location
// Dev: override with RELAY_DASHBOARD_DIR env var (e.g. packages/dashboard/dist)
const DASHBOARD_DIST =
  process.env.RELAY_DASHBOARD_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "dashboard");

export const app = new Hono();

// CORS middleware — restrict all /api/* and WebSocket origins to localhost only.
// Prevents cross-origin requests from arbitrary web pages while allowing the
// dashboard (served from the same localhost origin) to function normally.
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // Allow requests from localhost (any port) and 127.0.0.1 (any port).
      // Also allow requests with no Origin header (e.g. same-origin requests, curl).
      if (!origin) return origin;
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
          return origin;
        }
      } catch {
        // Malformed origin — deny
      }
      return null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Serve static files from the built React app
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// Pool cache for /api/agents — matches MCP server TTL so pool changes reflect within 5 minutes.
const AGENTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedAgents: ReturnType<typeof loadPool> | null = null;
let cachedAgentsAt = 0;

// API: agent list
app.get("/api/agents", (c) => {
  try {
    const now = Date.now();
    if (cachedAgents === null || now - cachedAgentsAt >= AGENTS_CACHE_TTL_MS) {
      try {
        cachedAgents = loadPool();
        cachedAgentsAt = now;
      } catch {
        // Pool not configured or failed — keep stale cache if available, otherwise empty
        if (cachedAgents === null) cachedAgents = {};
      }
    }
    return c.json(
      Object.values(cachedAgents).map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        description: a.description,
      }))
    );
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// API: session snapshot (used for initial dashboard load)
app.get("/api/session", (c) => {
  try {
    const db = getDb();
    const sessionId = getSessionId();
    return c.json({
      tasks: getAllTasks(db, sessionId),
      messages: getAllMessages(db, sessionId),
      artifacts: getAllArtifacts(db, sessionId),
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// API: list all sessions — used by FE session replay UI
app.get("/api/sessions", (c) => {
  try {
    return c.json(getAllSessions());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// API: session events (for history replay)
app.get("/api/sessions/:id/events", (c) => {
  const sessionId = c.req.param("id");
  // Validate session_id to prevent path traversal (consistent with /snapshot)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return c.json({ error: "Invalid session_id format" }, 400);
  }
  const events = getEventsBySession(sessionId);
  return c.json({ success: true, events });
});

// API: session snapshot — returns all tasks, messages, artifacts for a given session
app.get("/api/sessions/:id/snapshot", (c) => {
  const sessionId = c.req.param("id");
  // Validate session_id to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return c.json({ error: "Invalid session_id format" }, 400);
  }
  const db = getDb();
  return c.json({
    session_id: sessionId,
    tasks: getAllTasks(db, sessionId),
    messages: getAllMessages(db, sessionId),
    artifacts: getAllArtifacts(db, sessionId),
  });
});

// API: session summary
app.get("/api/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  // Validate session_id to prevent path traversal (consistent with /events and /snapshot)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  const result = await handleGetSessionSummary(getRelayDir(), { session_id: sessionId });
  if (!result.success) return c.json({ error: result.error }, 404);
  return c.json(result);
});

// Called by the PostToolUse hook — broadcasts agent:status events to the dashboard
app.post("/api/hook/tool-use", async (c) => {
  // Only accept requests from localhost origins (or same-origin with no Origin header).
  // This prevents cross-origin POST abuse since the hook endpoint is unauthenticated.
  const origin = c.req.header("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return c.json({ error: "forbidden" }, 403);
      }
    } catch {
      return c.json({ error: "forbidden" }, 403);
    }
  }

  // Claude Code delivers a payload via stdin with the structure:
  // { tool_name: "mcp__relay__send_message", tool_input: { agent_id: "pm", ... }, ... }
  let body: { tool_input?: { agent_id?: string } };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON payload" }, 400);
  }
  const agent: string = body.tool_input?.agent_id ?? "unknown";
  broadcast({
    type: "agent:status",
    agentId: markAsAgentId(agent),
    status: "working",
    timestamp: Date.now(),
  });
  return c.json({ ok: true });
});

// SPA fallback: serve index.html for all routes so React Router works.
// If the dashboard has not been built yet, return a helpful message.
app.get("*", async (_c) => {
  const indexPath = join(DASHBOARD_DIST, "index.html");
  try {
    await access(indexPath);
  } catch {
    return new Response("Dashboard not built. Run: bun run dashboard:build", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const content = await readFile(indexPath);
  return new Response(content, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});
