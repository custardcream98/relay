// packages/dashboard/src/state/snapshotHandler.ts
// Snapshot application logic extracted from dashboardReducer.ts for modularity.

import type { AgentId } from "relay-shared";
import { getEndDeclarationType } from "../components/activity/helpers";
import type { AgentMeta, DashboardEvent, Message, Task, TimelineEntry } from "../types";
import type { DashboardState } from "./dashboardReducer";

// Extract session:snapshot handling to a pure helper for readability and testability
export function applySnapshot(
  state: DashboardState,
  event: Extract<DashboardEvent, { type: "session:snapshot" }>,
  baseUpdates: Pick<DashboardState, "_seq" | "timeline" | "totalEventCount">
): DashboardState {
  // Snapshot payload is now fully typed — no casting needed
  const snapshotMessages: Message[] = event.messages;
  const snapshotTasks: Task[] = event.tasks as Task[];

  // Rebuild session team from snapshot if present
  const teamFromSnapshot: AgentMeta[] =
    event.agents && event.agents.length > 0
      ? event.agents.map((a) => ({ ...a, id: a.id as AgentId }))
      : state.sessionTeam;

  // Convert artifacts to timeline entries
  const artifactEntries: TimelineEntry[] = (event.artifacts ?? []).map((a) => ({
    id: `snap-artifact-${a.id}`,
    type: "artifact:posted" as const,
    agentId: a.created_by,
    description: `Artifact: ${a.name}`,
    detail: a.id,
    timestamp: a.created_at * 1000,
  }));

  // Convert reviews to timeline entries
  const reviewEntries: TimelineEntry[] = (event.reviews ?? []).flatMap((r) => {
    const entries: TimelineEntry[] = [
      {
        id: `snap-review-req-${r.id}`,
        type: "review:requested" as const,
        agentId: r.requester,
        description: `Review requested from ${r.reviewer}`,
        timestamp: r.created_at * 1000,
      },
    ];
    if (r.status !== "pending") {
      entries.push({
        id: `snap-review-upd-${r.id}`,
        type: "review:updated" as const,
        agentId: r.reviewer,
        description: `Review ${r.status}: ${r.reviewer}`,
        detail: r.comments ?? undefined,
        timestamp: r.updated_at * 1000,
      });
    }
    return entries;
  });

  const snapshotEntries: TimelineEntry[] = [
    ...snapshotMessages.map((m) => ({
      id: `snap-msg-${m.id}`,
      type: "message:new" as const,
      agentId: m.from_agent,
      description: m.to_agent ? `→ ${m.to_agent}` : "Broadcast message",
      detail: m.content,
      timestamp: m.created_at * 1000, // SQLite unixepoch → ms
    })),
    ...snapshotTasks.map((t) => ({
      id: `snap-task-${t.id}`,
      type: "task:updated" as const,
      agentId: t.assignee,
      description: `Task ${t.status.replaceAll("_", " ")}: ${t.title}`,
      // Use task's actual timestamp for correct chronological ordering
      timestamp: (t.updated_at ?? t.created_at ?? 0) * 1000,
    })),
    ...artifactEntries,
    ...reviewEntries,
  ].sort((a, b) => a.timestamp - b.timestamp);

  // Reconstruct agent statuses from snapshot messages.
  // First, collect all agents that appeared in messages (they are/were active).
  // Then apply end: declarations to override with terminal statuses.
  const activeAgents = new Set<string>();
  const endStatuses: DashboardState["agentStatuses"] = {};
  for (const m of snapshotMessages) {
    if (!m.from_agent) continue;
    activeAgents.add(m.from_agent);
    const endType = getEndDeclarationType(m.content ?? "");
    if (endType === "waiting") endStatuses[m.from_agent as AgentId] = "waiting";
    else if (endType === "done" || endType === "failed")
      endStatuses[m.from_agent as AgentId] = "done";
  }

  // Build restored statuses: agents with end: declarations get their terminal status,
  // agents that appeared in messages but have no end: declaration are inferred as "working".
  const restoredStatuses: DashboardState["agentStatuses"] = {};
  for (const agentId of activeAgents) {
    const id = agentId as AgentId;
    restoredStatuses[id] = endStatuses[id] ?? "working";
  }

  return {
    ...state,
    ...baseUpdates, // _seq updated; timeline intentionally overridden below
    tasks: snapshotTasks,
    messages: snapshotMessages,
    timeline: snapshotEntries,
    agentStatuses: restoredStatuses,
    instanceId: event.instanceId ?? state.instanceId,
    instancePort: event.port ?? state.instancePort,
    sessionTeam: teamFromSnapshot,
    liveSessionId: event.sessionId,
  };
}
