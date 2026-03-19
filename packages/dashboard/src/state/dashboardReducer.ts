// packages/dashboard/src/state/dashboardReducer.ts
// Extracted from App.tsx — pure state management for the dashboard.
// Large helpers (applySnapshot, insertSorted, eventToTimelineEntry) live in
// sibling modules; this file re-exports them for backward compatibility.

import type { AgentId } from "relay-shared";
import { getEndDeclarationType } from "../components/activity/helpers";
import type { AgentMeta, DashboardEvent, Message, Task, TimelineEntry } from "../types";
import { applySnapshot } from "./snapshotHandler";
import { eventToTimelineEntry, insertSorted } from "./timelineUtils";

// Re-export extracted helpers so existing imports keep working
export { applySnapshot } from "./snapshotHandler";
export { eventToTimelineEntry, insertSorted } from "./timelineUtils";

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
  // Total events received (never decremented) — used for truncation banner
  totalEventCount: number;
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
  totalEventCount: 0,
  _seq: 0,
};

export function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "EVENT": {
      const event = action.event;

      // Build timeline entry — agent:thinking replaces previous entry from the same agent
      let newTimeline = state.timeline;
      const entryId = `${event.type}-${state._seq}`;
      const entry = eventToTimelineEntry(event, entryId);

      // Base updates shared across all EVENT cases
      const baseUpdates = {
        _seq: state._seq + 1,
        timeline: newTimeline,
        totalEventCount: state.totalEventCount,
      };

      if (entry) {
        if (event.type === "agent:thinking") {
          // Prevent timeline flooding: replace existing thinking entry for the same agent
          const withoutPrev = state.timeline.filter(
            (e) => !(e.type === "agent:thinking" && e.agentId === event.agentId)
          );
          newTimeline = insertSorted(withoutPrev, entry);
        } else {
          newTimeline = insertSorted(state.timeline, entry);
        }
        // Keep at most 200 entries (trim oldest after sorted insertion)
        if (newTimeline.length > 200) {
          newTimeline = newTimeline.slice(-200);
        }
        baseUpdates.timeline = newTimeline;
        baseUpdates.totalEventCount = state.totalEventCount + 1;
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
            totalEventCount: 0,
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
