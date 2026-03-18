// packages/dashboard/src/state/timelineUtils.ts
// Timeline entry helpers extracted from dashboardReducer.ts for modularity.

import type { DashboardEvent, TimelineEntry } from "../types";

/**
 * Insert entry into timeline maintaining timestamp order.
 * Uses binary search for O(log n) insertion point.
 * Falls back to end-append when timestamp >= last entry (common case).
 */
export function insertSorted(timeline: TimelineEntry[], entry: TimelineEntry): TimelineEntry[] {
  // Fast path: most live events are newer than everything in timeline
  if (timeline.length === 0 || entry.timestamp >= timeline[timeline.length - 1].timestamp) {
    return [...timeline, entry];
  }

  // Binary search for insertion point
  let lo = 0;
  let hi = timeline.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (timeline[mid].timestamp <= entry.timestamp) lo = mid + 1;
    else hi = mid;
  }
  const result = [...timeline];
  result.splice(lo, 0, entry);
  return result;
}

// Convert RelayEvent to TimelineEntry
export function eventToTimelineEntry(event: DashboardEvent, id: string): TimelineEntry | null {
  switch (event.type) {
    case "message:new":
      return {
        id,
        type: event.type,
        agentId: event.message.from_agent,
        description: event.message.to_agent ? `→ ${event.message.to_agent}` : "Broadcast message",
        detail: event.message.content,
        timestamp: event.timestamp,
      };
    case "task:updated":
      return {
        id,
        type: event.type,
        agentId: event.task.assignee,
        description: `Task ${event.task.status.replaceAll("_", " ")}: ${event.task.title}`,
        timestamp: event.timestamp,
      };
    case "artifact:posted":
      return {
        id,
        type: event.type,
        agentId: event.artifact.created_by,
        description: `Artifact: ${event.artifact.name}`,
        detail: event.artifact.id,
        timestamp: event.timestamp,
      };
    case "agent:thinking":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: "Thinking…",
        detail: event.chunk,
        timestamp: event.timestamp,
      };
    case "review:requested":
      return {
        id,
        type: event.type,
        agentId: event.review.requester,
        description: `Review requested from ${event.review.reviewer}`,
        timestamp: event.timestamp,
      };
    case "review:updated":
      return {
        id,
        type: event.type,
        agentId: event.review.reviewer,
        description: `Review ${event.review.status.replaceAll("_", " ")}: ${event.review.reviewer}`,
        detail: event.review.comments ?? undefined,
        timestamp: event.timestamp,
      };
    case "agent:status":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: `Status → ${event.status}`,
        timestamp: event.timestamp,
      };
    case "memory:updated":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: "Memory updated",
        timestamp: event.timestamp,
      };
    case "agent:joined":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: "joined session",
        timestamp: event.timestamp,
      };
    default:
      return null;
  }
}
