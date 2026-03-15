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
  _seq: number; // sequence counter for pure reducer
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
    default:
      return null;
  }
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
            liveSessionId: event.sessionId,
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
        case "review:updated":
          // Timeline entry is already added via eventToTimelineEntry — no state mutation needed beyond that
          return { ...state, ...baseUpdates };
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

  // Active relay server URL — must be declared before useRelaySocket so the hook gets the URL
  const [activeServer, setActiveServer] = useState<string>(
    `${window.location.protocol}//${window.location.host}`
  );

  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event: event as DashboardEvent });
  }, []);
  const { connected, reconnecting, attempt, nextRetryIn, retryNow } = useRelaySocket({
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
  } = state;

  const isFocusMode = selectedAgent !== null;

  // (Messages tab removed — messages are displayed in ActivityFeed above)

  // Fetch agent list — passed as props to AgentArena
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);

  // Re-fetch agent list when the active server changes
  useEffect(() => {
    setAgentsLoading(true);
    setAgentsError(false);
    const base = activeServer.replace(/\/$/, "");
    fetch(`${base}/api/agents`)
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
  }, [activeServer]);

  // Fetch server list — BE will add GET /api/servers; graceful fallback to empty array
  const [servers, setServers] = useState<ServerEntry[]>([]);

  useEffect(() => {
    const base = activeServer.replace(/\/$/, "");
    fetch(`${base}/api/servers`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ServerEntry[]>;
      })
      .then((data) => setServers(data))
      .catch(() => {
        // Graceful: /api/servers not yet available — single-server mode, no switcher shown
        setServers([]);
      });
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
    taskBoardCollapsed,
    onToggleTaskBoard,
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
        activeServer={activeServer}
        onSwitchServer={handleSwitchServer}
        onAddServer={handleAddServer}
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
          {/* Top: ActivityFeed — drag-resizable height; expands to fill when TaskBoard is collapsed */}
          <div
            style={{
              // When TaskBoard is collapsed, fill all remaining space; otherwise use the drag-set percentage
              ...(taskBoardCollapsed
                ? { flex: "1 1 0" }
                : { height: `${timelinePct}%`, flexShrink: 0 }),
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

          {/* Row resize divider — hidden when task board is collapsed (nothing to resize) */}
          {!taskBoardCollapsed && (
            <Divider orientation="vertical" onMouseDown={onVDividerMouseDown} />
          )}

          {/* Bottom: TaskBoard/MessageFeed tabs, or AgentDetailPanel in focus mode */}
          <div
            style={{
              // When task board is collapsed (and not in focus mode), lock to the 28px rail height.
              // Use an explicit flex-basis instead of "auto" to prevent some browsers from
              // collapsing the container to 0 when overflow: hidden is set.
              flex: !isFocusMode && taskBoardCollapsed ? "0 0 28px" : "1 1 0",
              minHeight: !isFocusMode && taskBoardCollapsed ? 28 : undefined,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
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
            ) : taskBoardCollapsed ? (
              // Collapsed task board: thin horizontal rail with expand button
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 28,
                  flexShrink: 0,
                  paddingLeft: 8,
                  borderTop: "1px solid var(--color-border-subtle)",
                  background: "var(--color-surface-base)",
                }}
              >
                <button
                  type="button"
                  onClick={onToggleTaskBoard}
                  title="Expand Task Board"
                  style={{
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-disabled)",
                    flexShrink: 0,
                  }}
                >
                  {/* Chevron up — click to expand task board */}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2 8.5L6 4.5L10 8.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Task Board
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
                  {tasks.length}
                </span>
              </div>
            ) : (
              // Normal mode: Task Board (messages are in ActivityFeed above)
              <>
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
                      Task Board
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
                      {tasks.length}
                    </span>
                  </div>
                  {/* Collapse button */}
                  <button
                    type="button"
                    onClick={onToggleTaskBoard}
                    title="Collapse Task Board"
                    style={{
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 4,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--color-text-disabled)",
                      flexShrink: 0,
                    }}
                  >
                    {/* Chevron down — click to collapse task board */}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M2 4.5L6 8.5L10 4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
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
