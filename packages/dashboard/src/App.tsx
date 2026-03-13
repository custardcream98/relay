// packages/dashboard/src/App.tsx
// Two-panel layout: left (AgentArena) + right (EventTimeline + TaskBoard/AgentDetailPanel)

import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useEffect, useReducer, useState } from "react";
import { AgentArena } from "./components/AgentArena";
import { AgentDetailPanel } from "./components/AgentDetailPanel";
import { AppHeader } from "./components/AppHeader";
import { EventTimeline } from "./components/EventTimeline";
import { TaskBoard } from "./components/TaskBoard";
import { usePanelResize } from "./hooks/usePanelResize";
import { useRelaySocket } from "./hooks/useRelaySocket";
import type { AgentMeta, Message, Task, TimelineEntry } from "./types";

// Global dashboard state
interface DashboardState {
  tasks: Task[];
  messages: Message[];
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  selectedAgent: AgentId | null;
  timeline: TimelineEntry[];
  _seq: number; // sequence counter for pure reducer
}

type Action =
  | { type: "EVENT"; event: RelayEvent }
  | { type: "SELECT_AGENT"; agentId: AgentId | null };

const initialState: DashboardState = {
  tasks: [],
  messages: [],
  agentStatuses: {},
  thinkingChunks: {},
  selectedAgent: null,
  timeline: [],
  _seq: 0,
};

// Convert RelayEvent to TimelineEntry
function eventToTimelineEntry(event: RelayEvent, id: string): TimelineEntry | null {
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
          // Rebuild timeline from snapshot messages and tasks
          const snapshotMessages = event.messages as Message[];
          const snapshotTasks = event.tasks as Task[];
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
              timestamp: Date.now(),
            })),
          ].sort((a, b) => a.timestamp - b.timestamp);
          return {
            ...state,
            ...baseUpdates,
            tasks: snapshotTasks,
            messages: snapshotMessages,
            timeline: snapshotEntries,
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
        case "message:new":
          return {
            ...state,
            ...baseUpdates,
            messages: [event.message, ...state.messages],
          };
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
        default:
          return { ...state, ...baseUpdates };
      }
    }
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };
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
    dispatch({ type: "EVENT", event });
  }, []);
  const { connected } = useRelaySocket({ onEvent: handleEvent });
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent, timeline } = state;

  const isFocusMode = selectedAgent !== null;

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

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--color-surface-root)", color: "var(--color-text-primary)" }}
    >
      <AppHeader
        connected={connected}
        agentCount={agents.length}
        selectedAgent={selectedAgent}
        onClearFocus={() => dispatch({ type: "SELECT_AGENT", agentId: null })}
      />

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
          {/* Top: EventTimeline — drag-resizable height */}
          <div
            style={{
              height: `${timelinePct}%`,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PanelHeader label="Event Timeline" badge={timeline.length} />
            <div className="flex-1 overflow-hidden">
              <EventTimeline entries={timeline} focusAgent={selectedAgent} />
            </div>
          </div>

          {/* Row resize divider */}
          <Divider orientation="vertical" onMouseDown={onVDividerMouseDown} />

          {/* Bottom: TaskBoard or AgentDetailPanel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <PanelHeader label={isFocusMode ? `${selectedAgent} — detail` : "Task Board"} />
            <div className="flex-1 overflow-hidden">
              {isFocusMode && selectedAgent ? (
                <AgentDetailPanel
                  agentId={selectedAgent}
                  status={agentStatuses[selectedAgent] ?? "idle"}
                  thinkingChunk={thinkingChunks[selectedAgent] ?? ""}
                  messages={messages}
                  tasks={tasks}
                />
              ) : (
                <TaskBoard tasks={tasks} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
