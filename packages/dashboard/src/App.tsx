// packages/dashboard/src/App.tsx
// 새로운 두 존 레이아웃: 왼쪽(AgentArena) + 오른쪽(EventTimeline + TaskBoard/AgentDetailPanel)

import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useReducer, useRef, useState } from "react";
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
        case "session:snapshot": {
          // 스냅샷의 기존 메시지/태스크를 타임라인 항목으로 변환
          const snapshotMessages = event.messages as DashboardState["messages"];
          const snapshotTasks = event.tasks as DashboardState["tasks"];
          const snapshotEntries: TimelineEntry[] = [
            ...snapshotMessages.map((m) => ({
              id: `snap-msg-${m.id}`,
              type: "message:new" as const,
              agentId: m.from_agent,
              description: m.to_agent ? `Message to ${m.to_agent}` : "Broadcast message",
              detail: m.content.slice(0, 120),
              timestamp: m.created_at * 1000, // SQLite unixepoch → ms
            })),
            ...snapshotTasks.map((t) => ({
              id: `snap-task-${t.id}`,
              type: "task:updated" as const,
              agentId: t.assignee,
              description: `Task ${t.status.replace("_", " ")}: ${t.title}`,
              timestamp: Date.now(),
            })),
          ].sort((a, b) => a.timestamp - b.timestamp);
          return {
            ...state,
            tasks: snapshotTasks,
            messages: snapshotMessages,
            timeline: snapshotEntries,
          };
        }
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

// 드래그 리사이즈 핸들 컴포넌트 — hr 태그 사용으로 semantic separator 충족
function HDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <hr
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        height: "100%",
        border: "none",
        margin: 0,
        cursor: "col-resize",
        background: "var(--color-border-subtle)",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLHRElement).style.background = "var(--color-border-default)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLHRElement).style.background = "var(--color-border-subtle)";
      }}
    />
  );
}

function VDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <hr
      onMouseDown={onMouseDown}
      style={{
        width: "100%",
        height: 4,
        border: "none",
        margin: 0,
        cursor: "row-resize",
        background: "var(--color-border-subtle)",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLHRElement).style.background = "var(--color-border-default)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLHRElement).style.background = "var(--color-border-subtle)";
      }}
    />
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event });
  }, []);
  const { connected } = useRelaySocket({ onEvent: handleEvent });
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent, timeline } = state;

  const agentCountRef = useRef(0);
  const isFocusMode = selectedAgent !== null;

  // 드래그 리사이즈 상태
  const [arenaWidth, setArenaWidth] = useState(320); // 좌우 분할 (px)
  const [timelinePct, setTimelinePct] = useState(55); // 상하 분할 (%)
  const containerRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  // 좌우 드래그 핸들러
  const onHDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = arenaWidth;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(180, Math.min(520, startW + delta));
        setArenaWidth(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [arenaWidth]
  );

  // 상하 드래그 핸들러
  const onVDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startPct = timelinePct;
      const activityH = activityRef.current?.clientHeight ?? 600;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        const nextPx = (startPct / 100) * activityH + delta;
        const next = Math.max(20, Math.min(80, (nextPx / activityH) * 100));
        setTimelinePct(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [timelinePct]
  );

  return (
    <div
      ref={containerRef}
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
        {/* 왼쪽: Agent Arena (드래그로 너비 조정 가능) */}
        <div style={{ width: arenaWidth, flexShrink: 0 }}>
          <AgentArena
            statuses={agentStatuses}
            thinkingChunks={thinkingChunks}
            tasks={tasks}
            messages={messages}
            selectedAgent={selectedAgent}
            onSelectAgent={(id) => dispatch({ type: "SELECT_AGENT", agentId: id })}
          />
        </div>

        {/* 좌우 구분선 (드래그 가능) */}
        <HDivider onMouseDown={onHDividerMouseDown} />

        {/* 오른쪽: Activity Zone */}
        <div ref={activityRef} className="flex flex-col flex-1 overflow-hidden">
          {/* 상단: EventTimeline (드래그로 비율 조정 가능) */}
          <div
            style={{
              height: `${timelinePct}%`,
              flexShrink: 0,
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

          {/* 상하 구분선 (드래그 가능) */}
          <VDivider onMouseDown={onVDividerMouseDown} />

          {/* 하단: TaskBoard 또는 AgentDetailPanel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
