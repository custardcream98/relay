// packages/dashboard/src/App.tsx
// Two-panel layout: left (AgentArena) + right (ActivityFeed + TaskBoard/AgentDetailPanel)

import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useEffect, useReducer, useState } from "react";
import { ActivityFeed } from "./components/ActivityFeed";
import { AgentArena } from "./components/AgentArena";
import { AgentDetailPanel } from "./components/AgentDetailPanel";
import { AppHeader } from "./components/AppHeader";
import { TaskBoard } from "./components/TaskBoard";
import { usePanelResize } from "./hooks/usePanelResize";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { useTheme } from "./hooks/useTheme";
import type {
  AgentMeta,
  DashboardEvent,
  Message,
  ServerEntry,
  Task,
  TeamComposedEvent,
  TimelineEntry,
} from "./types";

// Snapshot response from GET /api/sessions/:id/snapshot
interface SessionSnapshotData {
  session_id: string;
  tasks: Task[];
  messages: Message[];
  artifacts: unknown[];
}

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
  // Session team — from team:composed or session:snapshot
  sessionTeam: AgentMeta[];
  // Session switcher — null = live current session, string = viewing historical session
  viewingSessionId: string | null;
  // Live state backup — saved when switching to historical session, restored on Back to Live
  _liveSnapshot: { tasks: Task[]; messages: Message[]; timeline: TimelineEntry[] } | null;
  _seq: number; // sequence counter for pure reducer
}

type Action =
  | { type: "EVENT"; event: DashboardEvent }
  | { type: "SELECT_AGENT"; agentId: AgentId | null }
  | { type: "SET_SESSION_SNAPSHOT"; snapshot: SessionSnapshotData }
  | { type: "CLEAR_SESSION_SNAPSHOT" };

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
  viewingSessionId: null,
  _liveSnapshot: null,
  _seq: 0,
};

// Type guard: check if an event is team:composed
function isTeamComposedEvent(event: DashboardEvent): event is TeamComposedEvent {
  return event.type === "team:composed";
}

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
    case "team:composed":
      return {
        id,
        type: "team:composed",
        agentId: null,
        description: `Team composed: ${event.agents.map((a: { name: string }) => a.name).join(", ")}`,
        timestamp: event.timestamp,
      };
    default:
      return null;
  }
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "EVENT": {
      // Skip live WebSocket events when viewing a historical session
      // (tasks and messages are frozen to the snapshot; only let session:snapshot and session:started through)
      if (
        state.viewingSessionId !== null &&
        action.event.type !== "session:snapshot" &&
        action.event.type !== "session:started"
      ) {
        return state;
      }

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

      // Handle team:composed before the switch so TypeScript narrows correctly
      if (isTeamComposedEvent(event)) {
        return {
          ...state,
          ...baseUpdates,
          sessionTeam: event.agents.map((a) => ({
            id: a.id as AgentId,
            name: a.name,
            emoji: a.emoji,
          })),
        };
      }

      switch (event.type) {
        case "session:snapshot": {
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
          };
        }
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
            viewingSessionId: null,
            _liveSnapshot: null,
          };
        default:
          return { ...state, ...baseUpdates };
      }
    }
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };

    case "SET_SESSION_SNAPSHOT": {
      const { snapshot } = action;
      // Build timeline from snapshot tasks + messages
      const snapEntries: TimelineEntry[] = [
        ...snapshot.messages.map((m) => ({
          id: `hsnap-msg-${m.id}`,
          type: "message:new" as const,
          agentId: m.from_agent,
          description: m.to_agent ? `→ ${m.to_agent}` : "Broadcast message",
          detail: m.content,
          timestamp: m.created_at * 1000,
        })),
        ...snapshot.tasks.map((t) => ({
          id: `hsnap-task-${t.id}`,
          type: "task:updated" as const,
          agentId: t.assignee,
          description: `Task ${t.status.replaceAll("_", " ")}: ${t.title}`,
          // Use task's actual timestamp for correct chronological ordering in history replay
          timestamp: (t.updated_at ?? t.created_at ?? 0) * 1000,
        })),
      ].sort((a, b) => a.timestamp - b.timestamp);

      return {
        ...state,
        viewingSessionId: snapshot.session_id,
        // Save current live state so we can restore it on CLEAR_SESSION_SNAPSHOT
        _liveSnapshot:
          state.viewingSessionId === null
            ? { tasks: state.tasks, messages: state.messages, timeline: state.timeline }
            : state._liveSnapshot,
        tasks: snapshot.tasks,
        messages: snapshot.messages,
        timeline: snapEntries,
      };
    }

    case "CLEAR_SESSION_SNAPSHOT": {
      // Restore live state saved before switching to historical session
      if (state._liveSnapshot) {
        return {
          ...state,
          viewingSessionId: null,
          _liveSnapshot: null,
          tasks: state._liveSnapshot.tasks,
          messages: state._liveSnapshot.messages,
          timeline: state._liveSnapshot.timeline,
        };
      }
      return { ...state, viewingSessionId: null, _liveSnapshot: null };
    }

    default:
      return state;
  }
}

// Drag resize handle — intentionally a div (hr cannot be sized in flex row/column)
function Divider({
  orientation,
  onMouseDown,
}: {
  orientation: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const isH = orientation === "horizontal";
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        [isH ? "width" : "height"]: 4,
        ...(isH ? { alignSelf: "stretch" } : {}),
        flexShrink: 0,
        cursor: isH ? "col-resize" : "row-resize",
        background: "var(--color-border-subtle)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-border-default)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-border-subtle)";
      }}
    />
  );
}

// Panel top label + optional badge
function PanelHeader({ label, badge }: { label: string; badge?: number | string }) {
  return (
    <div
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 36,
        borderBottom: "1px solid var(--color-border-subtle)",
        background: "var(--color-surface-base)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </span>
      {badge !== undefined && (
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            background: "var(--color-surface-overlay)",
            color: "var(--color-text-secondary)",
            padding: "1px 6px",
            borderRadius: 9999,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event: event as DashboardEvent });
  }, []);
  const { connected, reconnecting, attempt, nextRetryIn, retryNow } = useRelaySocket({
    onEvent: handleEvent,
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
    viewingSessionId,
  } = state;

  // Session switcher — load a historical session snapshot
  const handleSelectSession = useCallback((sessionId: string) => {
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/snapshot`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SessionSnapshotData>;
      })
      .then((snapshot) => {
        dispatch({ type: "SET_SESSION_SNAPSHOT", snapshot });
      })
      .catch(() => {
        // Silently ignore fetch errors
      });
  }, []);

  // Back to Live — restore live state and resume WebSocket updates
  const handleBackToLive = useCallback(() => {
    dispatch({ type: "CLEAR_SESSION_SNAPSHOT" });
  }, []);

  const isFocusMode = selectedAgent !== null;

  // (Messages tab removed — messages are displayed in ActivityFeed above)

  // Fetch agent list — passed as props to AgentArena
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setAgents(data);
        setAgentsLoading(false);
      })
      .catch(() => {
        setAgentsError(true);
        setAgentsLoading(false);
      });
  }, []);

  // Fetch server list — BE will add GET /api/servers; graceful fallback to empty array
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const currentServerUrl = `${window.location.protocol}//${window.location.host}`;

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ServerEntry[]>;
      })
      .then((data) => setServers(data))
      .catch(() => {
        // Graceful: /api/servers not yet available — single-server mode, no switcher shown
        setServers([]);
      });
  }, []);

  // Handle server switch — clear state and reconnect (future: pass new URL to useRelaySocket)
  const handleSwitchServer = useCallback((_url: string) => {
    // TODO: reconnect WebSocket to new server when useRelaySocket supports dynamic URLs
    // For now this is a no-op placeholder; ServerSwitcher renders null for single server
  }, []);

  const handleAddServer = useCallback((url: string) => {
    setServers((prev) => [...prev, { url, label: url, status: "connecting", isActive: false }]);
  }, []);

  // Panel resize state and handlers
  const {
    arenaWidth,
    arenaCollapsed,
    isDraggingArena,
    timelinePct,
    activityRef,
    onHDividerMouseDown,
    onVDividerMouseDown,
    onToggleCollapse,
  } = usePanelResize();

  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--color-surface-root)", color: "var(--color-text-primary)" }}
    >
      <AppHeader
        connected={connected}
        reconnecting={reconnecting}
        agentCount={agents.length}
        selectedAgent={selectedAgent}
        onClearFocus={() => dispatch({ type: "SELECT_AGENT", agentId: null })}
        instanceId={instanceId}
        instancePort={instancePort}
        sessionTeam={sessionTeam}
        servers={servers}
        activeServer={currentServerUrl}
        onSwitchServer={handleSwitchServer}
        onAddServer={handleAddServer}
        viewingSessionId={viewingSessionId}
        onSelectSession={handleSelectSession}
        onBackToLive={handleBackToLive}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Offline banner — shown only while reconnecting */}
      {!connected && reconnecting && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "7px 16px",
            background: "#92400e",
            color: "#fef3c7",
            fontSize: 12,
            fontWeight: 500,
            flexShrink: 0,
            borderBottom: "1px solid #b45309",
          }}
        >
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>
            Connection lost — reconnecting in {nextRetryIn}s (attempt {attempt + 1}/5)
          </span>
          <button
            type="button"
            onClick={retryNow}
            style={{
              marginLeft: 8,
              padding: "2px 10px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid #fef3c7",
              background: "transparent",
              color: "#fef3c7",
            }}
          >
            Retry now
          </button>
        </div>
      )}

      {/* Main two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Agent Arena — collapsible, drag-resizable width */}
        <div
          style={{
            width: arenaCollapsed ? 32 : arenaWidth,
            flexShrink: 0,
            overflow: "hidden",
            transition: isDraggingArena ? "none" : "width 200ms ease",
          }}
        >
          <AgentArena
            agents={agents}
            agentsLoading={agentsLoading}
            agentsError={agentsError}
            statuses={agentStatuses}
            thinkingChunks={thinkingChunks}
            tasks={tasks}
            messages={messages}
            selectedAgent={selectedAgent}
            onSelectAgent={(id) => dispatch({ type: "SELECT_AGENT", agentId: id })}
            collapsed={arenaCollapsed}
            onToggleCollapse={onToggleCollapse}
          />
        </div>

        {/* Column resize divider — hidden when collapsed */}
        {!arenaCollapsed && <Divider orientation="horizontal" onMouseDown={onHDividerMouseDown} />}

        {/* Right: activity area */}
        <div ref={activityRef} className="flex flex-col flex-1 overflow-hidden">
          {/* Top: ActivityFeed — drag-resizable height */}
          <div
            style={{
              height: `${timelinePct}%`,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="flex items-center justify-between shrink-0"
              style={{
                height: 36,
                borderBottom: "1px solid var(--color-border-subtle)",
                background: "var(--color-surface-base)",
                paddingLeft: 16,
                paddingRight: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Activity
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    background: "var(--color-surface-overlay)",
                    color: "var(--color-text-secondary)",
                    padding: "1px 6px",
                    borderRadius: 9999,
                  }}
                >
                  {timeline.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <ActivityFeed
                entries={timeline}
                focusAgent={selectedAgent}
                thinkingChunks={thinkingChunks}
                agentStatuses={agentStatuses}
              />
            </div>
          </div>

          {/* Row resize divider */}
          <Divider orientation="vertical" onMouseDown={onVDividerMouseDown} />

          {/* Bottom: TaskBoard/MessageFeed tabs, or AgentDetailPanel in focus mode */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {isFocusMode ? (
              // Focus mode: AgentDetailPanel takes the full bottom area
              <>
                <PanelHeader label={`${selectedAgent} — detail`} />
                <div className="flex-1 overflow-hidden">
                  <AgentDetailPanel
                    agentId={selectedAgent ?? ""}
                    status={agentStatuses[selectedAgent ?? ""] ?? "idle"}
                    thinkingChunk={thinkingChunks[selectedAgent ?? ""] ?? ""}
                    messages={messages}
                    tasks={tasks}
                  />
                </div>
              </>
            ) : (
              // Normal mode: Task Board (messages are in ActivityFeed above)
              <>
                <PanelHeader label="Task Board" badge={tasks.length} />
                <div className="flex-1 overflow-hidden">
                  <TaskBoard tasks={tasks} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
