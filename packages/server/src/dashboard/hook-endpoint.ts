// packages/server/src/dashboard/hook-endpoint.ts
// Extracted from hono.ts — handles the PostToolUse hook endpoint and agent-joined tracking.

import type { Hono } from "hono";
import { markAsAgentId } from "relay-shared";
import { getAgents } from "../agents/cache.js";
import { getSessionId } from "../config.js";
import { isValidId } from "../utils/validate.js";
import { isLocalhostOrigin } from "./utils.js";
import { broadcast } from "./websocket.js";

// Tracks agent IDs seen per session to emit agent:joined once per agent per session.
// Keyed by session ID so that when setSessionId() advances the session (e.g. a second
// /relay:relay invocation within the same process), agents re-emit agent:joined for the new session.
// Capped at MAX_SEEN_SESSIONS entries to prevent unbounded growth in long-running processes
// that run many relay sessions sequentially.
const MAX_SEEN_SESSIONS = 10;
const seenAgentIdsBySession = new Map<string, Set<string>>();

/**
 * Registers the POST /api/hook/tool-use endpoint on the given Hono app.
 * Called by the PostToolUse hook — broadcasts agent:status events to the dashboard.
 */
export function registerHookEndpoint(app: Hono): void {
  app.post("/api/hook/tool-use", async (c) => {
    // Only accept requests from localhost origins (or same-origin with no Origin header).
    // This prevents cross-origin POST abuse since the hook endpoint is unauthenticated.
    const origin = c.req.header("origin");
    // Reject cross-origin POST requests. isLocalhostOrigin() returns false for malformed
    // or non-localhost origins, so a single check covers all rejection cases.
    if (origin && !isLocalhostOrigin(origin)) {
      return c.json({ error: "forbidden" }, 403);
    }

    // Reject oversized payloads — hook bodies only need agent_id, tool_name; 64 KB is generous.
    const contentLength = Number(c.req.header("content-length") ?? 0);
    if (contentLength > 65_536) {
      return c.json({ error: "payload too large" }, 413);
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
      typeof rawAgentId === "string" && isValidId(rawAgentId) && rawAgentId.length <= 64
        ? rawAgentId
        : "unknown";

    const now = Date.now();
    const currentSessionId = getSessionId();

    // Emit agent:joined the first time this agent ID appears in the current session.
    // Using a per-session set ensures agents re-emit agent:joined when a new session starts
    // within the same server process (e.g. after setSessionId() is called).
    if (agentId !== "unknown") {
      let seenInSession = seenAgentIdsBySession.get(currentSessionId);
      if (!seenInSession) {
        seenInSession = new Set<string>();
        seenAgentIdsBySession.set(currentSessionId, seenInSession);
        // Evict the oldest session entry once the cap is exceeded to prevent unbounded growth.
        // Map iteration order is insertion order, so the first entry is always the oldest.
        if (seenAgentIdsBySession.size > MAX_SEEN_SESSIONS) {
          const oldestKey = seenAgentIdsBySession.keys().next().value;
          if (oldestKey !== undefined) seenAgentIdsBySession.delete(oldestKey);
        }
      }
      if (!seenInSession.has(agentId)) {
        seenInSession.add(agentId);
        let agentName = agentId;
        let agentEmoji = "\u{1F916}";
        try {
          const sessionAgents = getAgents(getSessionId());
          const match = sessionAgents?.[agentId];
          if (match) {
            agentName = match.name;
            agentEmoji = match.emoji;
          }
        } catch {
          /* fallback to defaults */
        }
        broadcast({
          type: "agent:joined",
          agentId: markAsAgentId(agentId),
          name: agentName,
          emoji: agentEmoji,
          sessionId: currentSessionId,
          timestamp: now,
        });
      }
    }

    broadcast({
      type: "agent:status",
      agentId: markAsAgentId(agentId),
      status: "working",
      timestamp: now,
    });
    return c.json({ ok: true });
  });
}
