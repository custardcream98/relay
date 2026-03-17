// packages/dashboard/src/App.tsx
// Data layer only — manages WebSocket, reducer state, and server-switching.
// Wraps AppLayout in the 4 focused context providers; no data props are passed down.

import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { AppLayout } from "./components/AppLayout";
import { AgentsContext } from "./context/AgentsContext";
import { ConnectionContext } from "./context/ConnectionContext";
import { PanelResizeProvider } from "./context/PanelResizeContext";
import { ServerContext } from "./context/ServerContext";
import { SessionContext } from "./context/SessionContext";
import { useRelaySocket } from "./hooks/useRelaySocket";
import type { AgentMeta, DashboardEvent, Message, ServerEntry, Task, TimelineEntry } from "./types";

// Global dashboard state
interface DashboardState {
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
  // Monotonic counter for stable timeline entry IDs — prevents returning the same state reference from reducer
  _seq: number;
}

type Action =
  | { type: "EVENT"; event: DashboardEvent }
  | { type: "SELECT_AGENT"; agentId: AgentId | null }
  | { type: "SWITCH_SERVER" };

const initialState: DashboardState = {
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
  _seq: 0,
};

// Convert RelayEvent to TimelineEntry
function eventToTimelineEntry(event: DashboardEvent, id: string): TimelineEntry | null {
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
function applySnapshot(
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
    const c = m.content ?? "";
    if (c.startsWith("end:waiting")) restoredStatuses[m.from_agent as AgentId] = "waiting";
    else if (c.startsWith("end:_done") || c.startsWith("end:failed"))
      restoredStatuses[m.from_agent as AgentId] = "done";
  }

  return {
    ...state,
    ...baseUpdates,
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

// Strip trailing slash from a server base URL so /api paths are constructed correctly
function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function reducer(state: DashboardState, action: Action): DashboardState {
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
          let statusOverride: "waiting" | "done" | null = null;
          if (content.startsWith("end:waiting")) statusOverride = "waiting";
          else if (content.startsWith("end:_done") || content.startsWith("end:failed"))
            statusOverride = "done";
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
                  { id: event.agentId, name: event.agentId, emoji: "🤖", joinedAt: Date.now() },
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Active relay server URL — must be declared before useRelaySocket so the hook gets the URL
  const [activeServer, setActiveServer] = useState<string>(
    `${window.location.protocol}//${window.location.host}`
  );

  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event: event as DashboardEvent });
  }, []);
  const { connected, reconnecting, maxRetriesExhausted, attempt, nextRetryIn, retryNow } =
    useRelaySocket({
      onEvent: handleEvent,
      // Pass the active server URL so the hook reconnects when the user switches servers
      serverUrl: activeServer,
    });

  const {
    tasks,
    messages,
    agentStatuses,
    thinkingChunks,
    selectedAgent,
    timeline,
    instanceId,
    instancePort,
    sessionTeam,
    liveSessionId,
  } = state;

  // Fetch agent list — passed to AgentArena via AgentsContext
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);

  // Re-fetch agent list when the active server changes.
  // Initial state already has agentsLoading=true, so no synchronous setState needed here.
  // On server switch the previous agent list stays visible until the new fetch resolves.
  useEffect(() => {
    const controller = new AbortController();
    const base = normalizeUrl(activeServer);
    fetch(`${base}/api/agents`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Array<{ id: AgentId; name: string; emoji: string; basePersonaId?: string }>) => {
        setAgents(
          data.map((item) => ({
            id: item.id,
            name: item.name,
            emoji: item.emoji,
            basePersonaId: item.basePersonaId,
          }))
        );
        setAgentsLoading(false);
        setAgentsError(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setAgentsError(true);
        setAgentsLoading(false);
      });
    return () => controller.abort();
  }, [activeServer]);

  // Fetch server list — BE will add GET /api/servers; graceful fallback to empty array
  const [servers, setServers] = useState<ServerEntry[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const base = normalizeUrl(activeServer);
    fetch(`${base}/api/servers`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ServerEntry[]>;
      })
      .then((data) => setServers(data))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Graceful: /api/servers not yet available — single-server mode, no switcher shown
        setServers([]);
      });
    return () => controller.abort();
  }, [activeServer]);

  // Switch active relay server: reconnects the WebSocket and clears stale state
  const handleSwitchServer = useCallback(
    (url: string) => {
      // No-op when already connected to the same server
      if (url === activeServer) return;
      setActiveServer(url);
      // Update isActive flags in the server list to reflect the new selection
      setServers((prev) => prev.map((s) => ({ ...s, isActive: s.url === url })));
      // Reset all session state — agentStatuses, thinkingChunks, tasks, messages etc.
      // are server-specific and must not bleed across server switches
      dispatch({ type: "SWITCH_SERVER" });
    },
    [activeServer]
  );

  const handleAddServer = useCallback((url: string) => {
    setServers((prev) => [...prev, { url, label: url, status: "connecting", isActive: false }]);
  }, []);

  const handleSelectAgent = useCallback((id: AgentId | null) => {
    dispatch({ type: "SELECT_AGENT", agentId: id });
  }, []);

  // Stabilize context values with useMemo so consumers only re-render when relevant state changes
  const sessionValue = useMemo(
    () => ({
      tasks,
      messages,
      agentStatuses,
      thinkingChunks,
      selectedAgent,
      timeline,
      instanceId,
      instancePort,
      sessionTeam,
      liveSessionId,
      onSelectAgent: handleSelectAgent,
    }),
    [
      tasks,
      messages,
      agentStatuses,
      thinkingChunks,
      selectedAgent,
      timeline,
      instanceId,
      instancePort,
      sessionTeam,
      liveSessionId,
      handleSelectAgent,
    ]
  );

  const connectionValue = useMemo(
    () => ({
      connected,
      reconnecting,
      maxRetriesExhausted,
      attempt,
      nextRetryIn,
      onRetryNow: retryNow,
    }),
    [connected, reconnecting, maxRetriesExhausted, attempt, nextRetryIn, retryNow]
  );

  const serverValue = useMemo(
    () => ({
      servers,
      activeServer,
      onSwitchServer: handleSwitchServer,
      onAddServer: handleAddServer,
    }),
    [servers, activeServer, handleSwitchServer, handleAddServer]
  );

  const agentsValue = useMemo(
    () => ({
      agents,
      agentsLoading,
      agentsError,
    }),
    [agents, agentsLoading, agentsError]
  );

  return (
    <SessionContext.Provider value={sessionValue}>
      <ConnectionContext.Provider value={connectionValue}>
        <ServerContext.Provider value={serverValue}>
          <AgentsContext.Provider value={agentsValue}>
            <PanelResizeProvider>
              <AppLayout />
            </PanelResizeProvider>
          </AgentsContext.Provider>
        </ServerContext.Provider>
      </ConnectionContext.Provider>
    </SessionContext.Provider>
  );
}
