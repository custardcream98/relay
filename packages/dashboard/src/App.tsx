// packages/dashboard/src/App.tsx
import type { AgentId, RelayEvent } from "@custardcream/relay-shared";
import { useCallback, useReducer } from "react";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { AgentThoughts } from "./components/AgentThoughts";
import { MessageFeed } from "./components/MessageFeed";
import { TaskBoard } from "./components/TaskBoard";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { useResizablePanels } from "./hooks/useResizablePanels";

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
};

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "EVENT": {
      const event = action.event;
      switch (event.type) {
        case "session:snapshot":
          return {
            ...state,
            tasks: event.tasks as DashboardState["tasks"],
            messages: event.messages as DashboardState["messages"],
          };
        case "agent:status":
          return {
            ...state,
            agentStatuses: { ...state.agentStatuses, [event.agentId]: event.status },
            thinkingChunks:
              event.status !== "working"
                ? { ...state.thinkingChunks, [event.agentId]: "" }
                : state.thinkingChunks,
          };
        case "agent:thinking":
          return {
            ...state,
            thinkingChunks: {
              ...state.thinkingChunks,
              [event.agentId]: (state.thinkingChunks[event.agentId] ?? "") + event.chunk,
            },
          };
        case "message:new":
          return { ...state, messages: [event.message, ...state.messages] };
        case "task:updated": {
          const existing = state.tasks.findIndex((t) => t.id === event.task.id);
          const tasks =
            existing >= 0
              ? state.tasks.map((t) => (t.id === event.task.id ? event.task : t))
              : [...state.tasks, event.task];
          return { ...state, tasks };
        }
        default:
          return state;
      }
    }
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };
    default:
      return state;
  }
}

// 패널 헤더 높이 (디자인 스펙: 32px)
const PANEL_HEADER_H = 32;

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event });
  }, []);
  const { connected } = useRelaySocket({ onEvent: handleEvent });
  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent } = state;

  // 3패널 리사이즈 훅
  const { widths, containerRef, startDrag } = useResizablePanels(3);

  const PANELS = [
    {
      label: "Task Board",
      content: <TaskBoard tasks={tasks} />,
    },
    {
      label: "Message Feed",
      content: <MessageFeed messages={messages} />,
    },
    {
      label: selectedAgent ? `${selectedAgent} — thoughts` : "Agent Thoughts",
      content: (
        <AgentThoughts
          agentId={selectedAgent}
          chunks={selectedAgent ? (thinkingChunks[selectedAgent] ?? "") : ""}
          status={selectedAgent ? (agentStatuses[selectedAgent] ?? "idle") : undefined}
        />
      ),
    },
  ];

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--color-surface-root)", color: "var(--color-text-primary)" }}
    >
      {/* 헤더 — h-10 (40px), surface-base 배경 */}
      <div
        className="flex items-center justify-between px-4 h-10 flex-shrink-0"
        style={{
          background: "var(--color-surface-base)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        {/* 왼쪽: relay wordmark + dashboard pill 배지 */}
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-sans)",
              color: "var(--color-text-primary)",
            }}
          >
            relay
          </span>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              background: "var(--color-surface-overlay)",
              color: "var(--color-text-tertiary)",
              padding: "1px 6px",
              borderRadius: 9999,
            }}
          >
            dashboard
          </span>
        </div>

        {/* 오른쪽: 연결 상태 도트 (6px) */}
        {/* biome-ignore lint/a11y/useSemanticElements: <output>은 폼 요소라 부적절; role="status"가 의미상 적합하므로 유지 */}
        <div
          className="flex items-center gap-1.5"
          role="status"
          aria-label={connected ? "Connected" : "Disconnected"}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              flexShrink: 0,
              display: "inline-block",
              background: connected
                ? "var(--color-connection-live)"
                : "var(--color-connection-dead)",
              boxShadow: connected ? "0 0 0 2px rgba(52,211,153,0.25)" : undefined,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-disabled)",
            }}
          >
            {connected ? "connected" : "disconnected"}
          </span>
        </div>
      </div>

      {/* 에이전트 상태 바 */}
      <AgentStatusBar
        statuses={agentStatuses}
        selected={selectedAgent}
        onSelect={(id) => dispatch({ type: "SELECT_AGENT", agentId: id })}
      />

      {/* 3패널 레이아웃 — 리사이즈 가능 */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {PANELS.map((panel, idx) => (
          <div
            key={panel.label}
            className="flex flex-col overflow-hidden"
            style={{ width: `${widths[idx]}%` }}
          >
            {/* 패널 헤더 — 32px */}
            <div
              style={{
                height: PANEL_HEADER_H,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                paddingLeft: 16,
                paddingRight: 16,
                borderBottom: "1px solid var(--color-border-subtle)",
                borderRight: "1px solid var(--color-border-subtle)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--color-text-disabled)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontFamily: "var(--font-sans)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {panel.label}
              </span>
            </div>

            {/* 패널 바디 */}
            <div
              className="overflow-hidden flex-1"
              style={{
                height: `calc(100% - ${PANEL_HEADER_H}px)`,
                borderRight: "1px solid var(--color-border-subtle)",
              }}
            >
              {panel.content}
            </div>
          </div>
        ))}

        {/* 드래그 핸들 — 패널 경계에 오버레이 */}
        {[0, 1].map((handleIdx) => (
          <div
            key={handleIdx}
            onMouseDown={(e) => startDrag(handleIdx, e)}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${widths.slice(0, handleIdx + 1).reduce((a, b) => a + b, 0)}%`,
              width: 6,
              transform: "translateX(-50%)",
              cursor: "col-resize",
              zIndex: 10,
            }}
            className="group flex items-center justify-center hover:bg-blue-500/20 transition-colors"
          >
            <div className="w-px h-full bg-transparent group-hover:bg-blue-500/50 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
