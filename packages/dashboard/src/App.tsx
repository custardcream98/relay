// packages/dashboard/src/App.tsx
// 새로운 두 존 레이아웃: 왼쪽(AgentArena) + 오른쪽(EventTimeline + TaskBoard/AgentDetailPanel)

import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useReducer, useRef } from "react";
import { AgentArena } from "./components/AgentArena";
import { AgentDetailPanel } from "./components/AgentDetailPanel";
import { AppHeader } from "./components/AppHeader";
import type { TimelineEntry } from "./components/EventTimeline";
import { EventTimeline } from "./components/EventTimeline";
import { TaskBoard } from "./components/TaskBoard";
import { useRelaySocket } from "./hooks/useRelaySocket";

// 대시보드 전역 상태
interface DashboardState {
  tasks: Array<{
    id: string;
    title: string;
    assignee: string | null;
    status: string;
    priority: string;
  }>;
  messages: Array<{
    id: string;
    from_agent: string;
    to_agent: string | null;
    content: string;
    created_at: number;
  }>;
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  selectedAgent: AgentId | null;
  timeline: TimelineEntry[];
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
};

// 이벤트에서 타임라인 항목 생성
function eventToTimelineEntry(event: RelayEvent, id: string): TimelineEntry | null {
  switch (event.type) {
    case "message:new":
      return {
        id,
        type: event.type,
        agentId: event.message.from_agent,
        description: event.message.to_agent
          ? `Message to ${event.message.to_agent}`
          : "Broadcast message",
        detail: event.message.content.slice(0, 120),
        timestamp: event.timestamp,
      };
    case "task:updated":
      return {
        id,
        type: event.type,
        agentId: event.task.assignee,
        description: `Task ${event.task.status.replace("_", " ")}: ${event.task.title}`,
        timestamp: event.timestamp,
      };
    case "artifact:posted":
      return {
        id,
        type: event.type,
        agentId: event.artifact.created_by,
        description: `Artifact posted: ${event.artifact.name}`,
        timestamp: event.timestamp,
      };
    case "agent:thinking":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: "Thinking…",
        detail: event.chunk.slice(0, 120),
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

let entryCounter = 0;

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "EVENT": {
      const event = action.event;

      // 타임라인 항목 생성 (thinking 이벤트는 빈도가 너무 높아 마지막 것만 유지)
      let newTimeline = state.timeline;
      const entryId = `${event.type}-${entryCounter++}`;
      const entry = eventToTimelineEntry(event, entryId);

      if (entry) {
        if (event.type === "agent:thinking") {
          // thinking 이벤트: 해당 에이전트의 기존 thinking 항목 교체 (스팸 방지)
          const withoutPrev = state.timeline.filter(
            (e) => !(e.type === "agent:thinking" && e.agentId === event.agentId)
          );
          newTimeline = [...withoutPrev, entry];
        } else {
          newTimeline = [...state.timeline, entry];
        }
        // 최대 200개 유지
        if (newTimeline.length > 200) {
          newTimeline = newTimeline.slice(newTimeline.length - 200);
        }
      }

      switch (event.type) {
        case "session:snapshot":
          return {
            ...state,
            tasks: event.tasks as DashboardState["tasks"],
            messages: event.messages as DashboardState["messages"],
            timeline: newTimeline,
          };
        case "agent:status":
          return {
            ...state,
            agentStatuses: { ...state.agentStatuses, [event.agentId]: event.status },
            thinkingChunks:
              event.status !== "working"
                ? { ...state.thinkingChunks, [event.agentId]: "" }
                : state.thinkingChunks,
            timeline: newTimeline,
          };
        case "agent:thinking":
          return {
            ...state,
            thinkingChunks: {
              ...state.thinkingChunks,
              [event.agentId]: (state.thinkingChunks[event.agentId] ?? "") + event.chunk,
            },
            timeline: newTimeline,
          };
        case "message:new":
          return {
            ...state,
            messages: [event.message, ...state.messages],
            timeline: newTimeline,
          };
        case "task:updated": {
          const existing = state.tasks.findIndex((t) => t.id === event.task.id);
          const tasks =
            existing >= 0
              ? state.tasks.map((t) => (t.id === event.task.id ? event.task : t))
              : [...state.tasks, event.task];
          return { ...state, tasks, timeline: newTimeline };
        }
        default:
          return { ...state, timeline: newTimeline };
      }
    }
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event });
  }, []);
  const { connected } = useRelaySocket({ onEvent: handleEvent });
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent, timeline } = state;

  // 에이전트 수 추적 (AgentArena에서 fetch하지만 헤더에도 표시)
  const agentCountRef = useRef(0);

  const isFocusMode = selectedAgent !== null;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--color-surface-root)", color: "var(--color-text-primary)" }}
    >
      {/* 앱 헤더 */}
      <AppHeader
        connected={connected}
        agentCount={agentCountRef.current}
        selectedAgent={selectedAgent}
        onClearFocus={() => dispatch({ type: "SELECT_AGENT", agentId: null })}
      />

      {/* 메인 두 존 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: Agent Arena (320px 고정) */}
        <AgentArena
          statuses={agentStatuses}
          thinkingChunks={thinkingChunks}
          tasks={tasks}
          messages={messages}
          selectedAgent={selectedAgent}
          onSelectAgent={(id) => dispatch({ type: "SELECT_AGENT", agentId: id })}
        />

        {/* 오른쪽: Activity Zone */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* 상단: EventTimeline (55%) */}
          <div
            style={{
              height: "55%",
              flexShrink: 0,
              borderBottom: "1px solid var(--color-border-subtle)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* 패널 헤더 */}
            <div
              className="flex items-center justify-between px-4 flex-shrink-0"
              style={{
                height: 36,
                borderBottom: "1px solid var(--color-border-subtle)",
                background: "var(--color-surface-base)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--color-text-disabled)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Event Timeline
              </span>
              {/* 이벤트 수 배지 */}
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  background: "var(--color-surface-overlay)",
                  color: "var(--color-text-tertiary)",
                  padding: "1px 6px",
                  borderRadius: 9999,
                }}
              >
                {timeline.length}
              </span>
            </div>

            {/* 타임라인 콘텐츠 */}
            <div className="flex-1 overflow-hidden">
              <EventTimeline entries={timeline} focusAgent={selectedAgent} />
            </div>
          </div>

          {/* 하단: TaskBoard 또는 AgentDetailPanel (45%) */}
          <div style={{ height: "45%", display: "flex", flexDirection: "column" }}>
            {/* 패널 헤더 */}
            <div
              className="flex items-center px-4 flex-shrink-0"
              style={{
                height: 36,
                borderBottom: "1px solid var(--color-border-subtle)",
                background: "var(--color-surface-base)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--color-text-disabled)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {isFocusMode ? `${selectedAgent} — detail` : "Task Board"}
              </span>
            </div>

            {/* 하단 패널 콘텐츠 */}
            <div className="flex-1 overflow-hidden">
              {isFocusMode && selectedAgent ? (
                // Focus Mode: AgentDetailPanel
                <AgentDetailPanel
                  agentId={selectedAgent}
                  status={agentStatuses[selectedAgent] ?? "idle"}
                  thinkingChunk={thinkingChunks[selectedAgent] ?? ""}
                  messages={messages}
                  tasks={tasks}
                />
              ) : (
                // 기본 모드: TaskBoard
                <TaskBoard tasks={tasks} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
