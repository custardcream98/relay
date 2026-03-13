// packages/server/src/dashboard/hono.ts

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { loadAgents } from "../agents/loader";
import { getRelayDir } from "../config";
import { getDb } from "../db/client";
import { getAllArtifacts } from "../db/queries/artifacts";
import { getEventsBySession } from "../db/queries/events";
import { getAllMessages } from "../db/queries/messages";
import { getAllTasks } from "../db/queries/tasks";
import { handleGetSessionSummary } from "../tools/sessions";
import { broadcast } from "./websocket";

const SESSION_ID = process.env.RELAY_SESSION_ID ?? "default";

// Bundled: resolve dashboard/ relative to this file's location
// Dev: override with RELAY_DASHBOARD_DIR env var (e.g. packages/dashboard/dist)
const DASHBOARD_DIST =
  process.env.RELAY_DASHBOARD_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "dashboard");

export const app = new Hono();

// Serve static files from the built React app
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// Lazy-loaded on first /api/agents request (after MCP init, getRelayDir() returns the correct path)
let cachedAgents: ReturnType<typeof loadAgents> | null = null;

// API: agent list
app.get("/api/agents", (c) => {
  try {
    if (!cachedAgents) cachedAgents = loadAgents();
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
  const db = getDb();
  return c.json({
    tasks: getAllTasks(db, SESSION_ID),
    messages: getAllMessages(db, SESSION_ID),
    artifacts: getAllArtifacts(db, SESSION_ID),
  });
});

// API: session events (for history replay)
app.get("/api/sessions/:id/events", (c) => {
  const sessionId = c.req.param("id");
  const events = getEventsBySession(sessionId);
  return c.json({ success: true, events });
});

// API: session summary
app.get("/api/sessions/:id", async (c) => {
  const result = await handleGetSessionSummary(getRelayDir(), { session_id: c.req.param("id") });
  if (!result.success) return c.json({ error: result.error }, 404);
  return c.json(result);
});

// Called by the PostToolUse hook — broadcasts agent:status events to the dashboard
app.post("/api/hook/tool-use", async (c) => {
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
    agentId: agent,
    status: "working",
    timestamp: Date.now(),
  });
  return c.json({ ok: true });
});

// SPA fallback: serve index.html for all routes so React Router works.
// If the dashboard has not been built yet, return a helpful message.
app.get("*", async (_c) => {
  const file = Bun.file(join(DASHBOARD_DIST, "index.html"));
  if (!(await file.exists())) {
    return new Response("Dashboard not built. Run: bun run dashboard:build", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(file);
});
