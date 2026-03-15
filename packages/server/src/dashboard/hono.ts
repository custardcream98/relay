// packages/server/src/dashboard/hono.ts

import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { markAsAgentId } from "@custardcream/relay-shared";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadPool } from "../agents/loader";
import { getInstanceId, getPort, getRelayDir, getSessionId } from "../config";
import { getDb } from "../db/client";
import { getAllArtifacts } from "../db/queries/artifacts";
import { getEventsBySession } from "../db/queries/events";
import { getAllMessages } from "../db/queries/messages";
import { getAllSessions } from "../db/queries/sessions";
import { getAllTasks } from "../db/queries/tasks";
import { handleGetSessionSummary, handleListSessions } from "../tools/sessions";
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
        basePersonaId: a.basePersonaId, // expose for dashboard agent disambiguation
      }))
    );
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// API: health check — uptime, session info, instance metadata
// Used by the dashboard connection status indicator
app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    sessionId: getSessionId(),
    instanceId: getInstanceId() ?? null,
    port: getPort(),
    uptime: Math.floor(process.uptime()),
  });
});

// API: session snapshot (used for initial dashboard load)
// Supports optional pagination via ?offset=N&limit=N on tasks and messages.
app.get("/api/session", (c) => {
  try {
    const db = getDb();
    const sessionId = getSessionId();
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 500) || 500));

    const allTasks = getAllTasks(db, sessionId);
    const allMessages = getAllMessages(db, sessionId);
    const allArtifacts = getAllArtifacts(db, sessionId);

    return c.json({
      tasks: allTasks.slice(offset, offset + limit),
      messages: allMessages.slice(offset, offset + limit),
      artifacts: allArtifacts,
      // Pagination metadata — lets the dashboard detect truncation
      total: {
        tasks: allTasks.length,
        messages: allMessages.length,
        artifacts: allArtifacts.length,
      },
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// API: in-memory session list derived from stored events (most-recent first)
// Separate from the file-based /api/sessions — covers the current live session
// even before a summary is saved to disk.
app.get("/api/sessions/live", (c) => {
  try {
    const sessions = getAllSessions(50);
    return c.json({ success: true, sessions });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// API: list saved sessions (sorted most-recent first)
app.get("/api/sessions", async (c) => {
  const result = await handleListSessions(getRelayDir());
  return c.json(result);
});

// API: replay all persisted events for a session in chronological order.
// Registered before /api/sessions/:id so Hono matches the literal "replay" segment first.
app.get("/api/sessions/:id/replay", (c) => {
  const sessionId = c.req.param("id");
  // Validate session_id to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  try {
    const events = getEventsBySession(sessionId);
    return c.json({ success: true, sessionId, events });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
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

// Tracks agent IDs seen within the current session to emit agent:joined once per agent.
// Reset is not needed — server process lifetime == session lifetime for typical usage.
const seenAgentIds = new Set<string>();

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
  const rawAgentId = body?.tool_input?.agent_id;
  const agentId =
    typeof rawAgentId === "string" && /^[a-zA-Z0-9_-]+$/.test(rawAgentId) && rawAgentId.length <= 64
      ? rawAgentId
      : "unknown";

  const now = Date.now();

  // Emit agent:joined the first time this agent ID appears in the session
  if (agentId !== "unknown" && !seenAgentIds.has(agentId)) {
    seenAgentIds.add(agentId);
    broadcast({
      type: "agent:joined",
      agentId: markAsAgentId(agentId),
      sessionId: getSessionId(),
      timestamp: now,
    });
  }

  broadcast({
    type: "agent:status",
    agentId: markAsAgentId(agentId),
    status: "working",
    timestamp: now,
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
