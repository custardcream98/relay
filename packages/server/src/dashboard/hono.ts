// packages/server/src/dashboard/hono.ts
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { getPool } from "../agents/cache.js";
import { getInstanceId, getPort, getRelayDir, getSessionId } from "../config.js";
import {
  getAllArtifacts,
  getAllMessages,
  getAllSessions,
  getAllTasks,
  getArtifactById,
} from "../store.js";
import { handleGetSessionSummary, handleListSessions } from "../tools/sessions.js";
import { taskToPayload } from "../utils/broadcast.js";
import { isValidId } from "../utils/validate.js";
import { registerHookEndpoint } from "./hook-endpoint.js";
import { isLocalhostOrigin } from "./utils.js";

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
      // Allow requests with no Origin header (e.g. same-origin requests, curl).
      // Return the origin string (not just true) so the CORS header echoes the exact value.
      if (!origin) return origin;
      return isLocalhostOrigin(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Serve static files from the built React app
app.use("/assets/*", serveStatic({ root: DASHBOARD_DIST }));

// API: agent list — delegates to shared cache (same TTL as MCP server pool cache)
app.get("/api/agents", (c) => {
  try {
    let agents: ReturnType<typeof getPool>;
    try {
      agents = getPool();
    } catch {
      // Pool not configured or failed — return empty list
      agents = {};
    }
    return c.json(
      Object.values(agents).map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        description: a.description,
        basePersonaId: a.basePersonaId, // expose for dashboard agent disambiguation
      }))
    );
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
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
// Note: the same offset/limit values are applied independently to both tasks and messages.
// There is no way to paginate tasks and messages separately via this endpoint.
// For independent pagination, clients should track totals and make separate requests,
// or rely on WebSocket events for incremental updates instead.
app.get("/api/session", (c) => {
  try {
    const sessionId = getSessionId();
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 500) || 500));

    const allTasks = getAllTasks(sessionId);
    const allMessages = getAllMessages(sessionId);
    const allArtifacts = getAllArtifacts(sessionId);

    // Use taskToPayload for consistent field normalization across WS/REST
    const taskPayloads = allTasks.slice(offset, offset + limit).map(taskToPayload);

    return c.json({
      tasks: taskPayloads,
      messages: allMessages
        .slice(offset, offset + limit)
        .map(({ session_id: _s, seq: _q, ...m }) => ({ ...m, metadata: m.metadata ?? null })),
      artifacts: allArtifacts.map(
        ({ session_id: _s, content: _c, task_id: _t, created_at: _ca, ...a }) => a
      ),
      // Pagination metadata — lets the dashboard detect truncation
      total: {
        tasks: allTasks.length,
        messages: allMessages.length,
        artifacts: allArtifacts.length,
      },
    });
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// API: fetch a single artifact with full content by ID
app.get("/api/artifacts/:id", (c) => {
  const artifactId = c.req.param("id");
  if (!isValidId(artifactId)) {
    return c.json({ success: false, error: "Invalid artifact ID" }, 400);
  }
  const sessionId = getSessionId();
  const artifact = getArtifactById(artifactId, sessionId);
  if (!artifact) {
    return c.json({ success: false, error: "Artifact not found" }, 404);
  }
  const { session_id: _, ...rest } = artifact;
  return c.json({ success: true, artifact: rest });
});

// API: in-memory session list derived from stored events (most-recent first)
// Separate from the file-based /api/sessions — covers the current live session
// even before a summary is saved to disk.
app.get("/api/sessions/live", (c) => {
  try {
    const sessions = getAllSessions(50);
    return c.json({ success: true, sessions });
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// API: list saved sessions (sorted most-recent first)
app.get("/api/sessions", async (c) => {
  const result = await handleListSessions(getRelayDir());
  return c.json(result);
});

// Completion check for the orchestrator Stop hook.
// Returns task completion status so the hook can decide whether to block the stop.
// Registered before /api/sessions/:id to prevent Hono matching "completion-check" as a session ID.
app.get("/api/sessions/:id/completion-check", (c) => {
  const sessionId = c.req.param("id");
  if (!isValidId(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  try {
    const allTasks = getAllTasks(sessionId);
    const totalCount = allTasks.length;
    const doneCount = allTasks.filter((t) => t.status === "done").length;
    const allDone = totalCount > 0 && doneCount === totalCount;
    const pendingTasks = allTasks
      .filter((t) => t.status !== "done")
      .map(({ id, title, status, assignee }) => ({ id, title, status, assignee }));
    return c.json({
      success: true,
      all_done: allDone,
      done_count: doneCount,
      total_count: totalCount,
      pending_tasks: pendingTasks,
    });
  } catch (err) {
    console.error("[relay] internal error:", err);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// API: session summary
app.get("/api/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  // Validate session_id to prevent path traversal (consistent with /events and /snapshot)
  if (!isValidId(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }
  const result = await handleGetSessionSummary(getRelayDir(), { session_id: sessionId });
  if (!result.success) return c.json({ success: false, error: result.error }, 404);
  return c.json(result);
});

// Hook endpoint: POST /api/hook/tool-use (agent-joined tracking + agent:status broadcast)
registerHookEndpoint(app);

// Serve favicon from dashboard dist (must be before SPA fallback)
app.use("/favicon.svg", serveStatic({ root: DASHBOARD_DIST }));

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
