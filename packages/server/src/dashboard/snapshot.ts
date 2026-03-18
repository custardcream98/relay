// packages/server/src/dashboard/snapshot.ts
// Builds the session:snapshot payload for initial WebSocket hydration.

import type { AgentId, RelayEvent } from "relay-shared";
import { getAgents } from "../agents/cache.js";
import { loadPool } from "../agents/loader.js";
import { getSessionId } from "../config.js";
import { getAllArtifacts, getAllMessages, getAllReviews, getAllTasks } from "../store.js";
import { taskToPayload } from "../utils/broadcast.js";

/**
 * Build a session:snapshot event payload serialized to JSON.
 * Used to hydrate the dashboard on initial WebSocket connection.
 * Typed as Extract<RelayEvent, { type: "session:snapshot" }> to catch payload shape drift at compile time.
 */
export function buildSessionSnapshot(port: number): string {
  const sessionId = getSessionId();

  // Load agent metadata for SessionTeamBadge hydration
  let agentMeta: Array<{ id: AgentId; name: string; emoji: string }> = [];
  try {
    // Prefer session agents (includes extends-resolved agents, scoped to current team)
    const sessionAgents = getAgents(getSessionId());
    if (sessionAgents && Object.keys(sessionAgents).length > 0) {
      agentMeta = Object.values(sessionAgents).map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
      }));
    } else {
      // Fallback to pool when session file doesn't exist yet
      const agents = loadPool();
      agentMeta = Object.values(agents).map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
      }));
    }
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
      ({ session_id: _s, content: _c, task_id: _t, ...a }) => a
    ),
    reviews: getAllReviews(sessionId).map(({ session_id: _s, ...r }) => r),
    instanceId: process.env.RELAY_INSTANCE,
    port,
    agents: agentMeta,
    timestamp: Date.now(),
  };

  return JSON.stringify(snapshot);
}
