// packages/dashboard/src/state/dashboardReducer.ts
// Extracted from App.tsx — pure state management for the dashboard.

import type { AgentId } from "relay-shared";
import { getEndDeclarationType } from "../components/activity/helpers";
import type { AgentMeta, DashboardEvent, Message, Task, TimelineEntry } from "../types";

// Global dashboard state
export interface DashboardState {
  tasks: Task[];
  messages: Message[];
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting" | "done">>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  selectedAgent: AgentId | null;
  timeline: TimelineEntry[];
  // Instance info — from session:snapshot (once BE ships instanceId/port)
  instanceId: string | undefined;
  instancePort: number | undefined;
  // Session team — from session:snapshot
  sessionTeam: AgentMeta[];
  // The session ID of the live session currently shown (from session:snapshot or session:started)
  liveSessionId: string | null;
  // Incremented on session:started — triggers agent list re-fetch so newly created pool is picked up
  sessionStartCount: number;
  // Monotonic counter for stable timeline entry IDs — prevents returning the same state reference from reducer
  _seq: number;
}

export type Action =
  | { type: "EVENT"; event: DashboardEvent }
  | { type: "SELECT_AGENT"; agentId: AgentId | null }
  | { type: "SWITCH_SERVER" };

export const initialState: DashboardState = {
  tasks: [],
  messages: [],
  agentStatuses: {},
  thinkingChunks: {},
  selectedAgent: null,
  timeline: [],
  instanceId: undefined,
  instancePort: undefined,
  sessionTeam: [],
  liveSessionId: null,
  sessionStartCount: 0,
  _seq: 0,
};

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

// Extract session:snapshot handling to a pure helper for readability and testability
export function applySnapshot(
  state: DashboardState,
  event: Extract<DashboardEvent, { type: "session:snapshot" }>,
  baseUpdates: Pick<DashboardState, "_seq" | "timeline">
): DashboardState {
  // Snapshot payload is now fully typed — no casting needed
  const snapshotMessages: Message[] = event.messages;
  const snapshotTasks: Task[] = event.tasks as Task[];

  // Rebuild session team from snapshot if present
  const teamFromSnapshot: AgentMeta[] =
    event.agents && event.agents.length > 0
      ? event.agents.map((a) => ({ ...a, id: a.id as AgentId }))
      : state.sessionTeam;

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
  ].sort((a, b) => a.timestamp - b.timestamp);

  // Reconstruct agent statuses from the last end: declaration in snapshot messages
  const restoredStatuses: DashboardState["agentStatuses"] = {};
  for (const m of snapshotMessages) {
    if (!m.from_agent) continue;
    const endType = getEndDeclarationType(m.content ?? "");
    if (endType === "waiting") restoredStatuses[m.from_agent as AgentId] = "waiting";
    else if (endType === "done" || endType === "failed")
      restoredStatuses[m.from_agent as AgentId] = "done";
  }

  return {
    ...state,
    ...baseUpdates, // _seq updated; timeline intentionally overridden below
    tasks: snapshotTasks,
    messages: snapshotMessages,
    timeline: snapshotEntries,
    agentStatuses: { ...state.agentStatuses, ...restoredStatuses },
    instanceId: event.instanceId ?? state.instanceId,
    instancePort: event.port ?? state.instancePort,
    sessionTeam: teamFromSnapshot,
    liveSessionId: event.sessionId,
  };
}

export function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "EVENT": {
      const event = action.event;

      // Build timeline entry — agent:thinking replaces previous entry from the same agent
      let newTimeline = state.timeline;
      const entryId = `${event.type}-${state._seq}`;
      const entry = eventToTimelineEntry(event, entryId);

      // Base updates shared across all EVENT cases
      const baseUpdates = { _seq: state._seq + 1, timeline: newTimeline };

      if (entry) {
        if (event.type === "agent:thinking") {
          // Prevent timeline flooding: replace existing thinking entry for the same agent
          const withoutPrev = state.timeline.filter(
            (e) => !(e.type === "agent:thinking" && e.agentId === event.agentId)
          );
          newTimeline = [...withoutPrev, entry];
        } else {
          newTimeline = [...state.timeline, entry];
        }
        // Keep at most 200 entries
        if (newTimeline.length > 200) {
          newTimeline = newTimeline.slice(newTimeline.length - 200);
        }
        baseUpdates.timeline = newTimeline;
      }

      switch (event.type) {
        case "session:snapshot":
          return applySnapshot(state, event, baseUpdates);
        case "agent:status":
          return {
            ...state,
            ...baseUpdates,
            agentStatuses: { ...state.agentStatuses, [event.agentId]: event.status },
            thinkingChunks:
              event.status !== "working"
                ? { ...state.thinkingChunks, [event.agentId]: "" }
                : state.thinkingChunks,
          };
        case "agent:thinking":
          return {
            ...state,
            ...baseUpdates,
            thinkingChunks: {
              ...state.thinkingChunks,
              [event.agentId]: (state.thinkingChunks[event.agentId] ?? "") + event.chunk,
            },
          };
        case "message:new": {
          // Detect end declarations to update agent status without a separate agent:status event
          const content = event.message.content ?? "";
          const fromAgent = event.message.from_agent;
          const endType = getEndDeclarationType(content);
          const statusOverride: "waiting" | "done" | null =
            endType === "waiting"
              ? "waiting"
              : endType === "done" || endType === "failed"
                ? "done"
                : null;
          return {
            ...state,
            ...baseUpdates,
            messages: [event.message, ...state.messages],
            agentStatuses:
              statusOverride && fromAgent
                ? { ...state.agentStatuses, [fromAgent]: statusOverride }
                : state.agentStatuses,
          };
        }
        case "task:updated": {
          // Shared type uses string for status, but runtime only receives TaskStatus values
          const incomingTask = event.task as Task;
          const existing = state.tasks.findIndex((t) => t.id === incomingTask.id);
          const tasks =
            existing >= 0
              ? state.tasks.map((t) => (t.id === incomingTask.id ? incomingTask : t))
              : [...state.tasks, incomingTask];
          return { ...state, ...baseUpdates, tasks };
        }
        case "review:updated":
          // Timeline entry is already added via eventToTimelineEntry — no state mutation needed beyond that
          return { ...state, ...baseUpdates };
        case "agent:joined": {
          // Add the newly-joined agent to sessionTeam if not already present
          const alreadyInTeam = state.sessionTeam.some((a) => a.id === event.agentId);
          return {
            ...state,
            ...baseUpdates,
            sessionTeam: alreadyInTeam
              ? state.sessionTeam
              : [
                  ...state.sessionTeam,
                  {
                    id: event.agentId,
                    name: event.name ?? event.agentId,
                    emoji: event.emoji ?? "🤖",
                    joinedAt: Date.now(),
                  },
                ],
          };
        }
        case "session:started":
          // A new relay session started — clear all live state so the dashboard shows a fresh run
          return {
            ...state,
            tasks: [],
            messages: [],
            agentStatuses: {},
            thinkingChunks: {},
            selectedAgent: null,
            timeline: [],
            sessionTeam: [],
            liveSessionId: event.sessionId,
            sessionStartCount: state.sessionStartCount + 1,
            _seq: 0,
          };
        default:
          return { ...state, ...baseUpdates };
      }
    }
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };

    case "SWITCH_SERVER":
      // Clear all session-specific state when switching to a different relay server.
      // The new server will send session:snapshot/session:started to repopulate.
      return {
        ...initialState,
        // Preserve resize/UI preferences — not server-specific
      };

    default:
      return state;
  }
}
