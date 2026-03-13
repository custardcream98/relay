// dashboard/src/App.tsx
import { useCallback, useReducer } from "react";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { TaskBoard } from "./components/TaskBoard";
import { MessageFeed } from "./components/MessageFeed";
import { AgentThoughts } from "./components/AgentThoughts";
import type { AgentId, RelayEvent } from "@shared/types";

// 대시보드 파생 상태 타입
interface DashboardState {
  tasks: Array<{ id: string; title: string; assignee: string | null; status: string; priority: string }>;
  messages: Array<{ id: string; from_agent: string; to_agent: string | null; content: string; created_at: number }>;
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
          // 초기 스냅샷 — WebSocket 연결 직후 서버에서 전송
          return {
            ...state,
            tasks: event.tasks as DashboardState["tasks"],
            messages: event.messages as DashboardState["messages"],
          };
        case "agent:status":
          return {
            ...state,
            agentStatuses: { ...state.agentStatuses, [event.agentId]: event.status },
            // idle/waiting 전환 시 thinking chunks 초기화
            thinkingChunks: event.status !== "working"
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
          // 최신 메시지를 앞에 추가 (최신 우선)
          return { ...state, messages: [event.message, ...state.messages] };
        case "task:updated": {
          const existing = state.tasks.findIndex((t) => t.id === event.task.id);
          const tasks = existing >= 0
            ? state.tasks.map((t) => (t.id === event.task.id ? event.task : t))
            : [...state.tasks, event.task];
          return { ...state, tasks };
        }
        case "artifact:posted":
          // 아티팩트는 현재 대시보드에서 별도 추적하지 않음
          return state;
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // useCallback으로 안정적인 참조 유지 — useRelaySocket 내부에서 ref로 관리되므로 사실상 불필요하나 명시적으로 선언
  const handleEvent = useCallback((event: RelayEvent) => {
    dispatch({ type: "EVENT", event });
  }, []);

  const { connected } = useRelaySocket({ onEvent: handleEvent });

  const { tasks, messages, agentStatuses, thinkingChunks, selectedAgent } = state;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="font-bold text-lg">relay</span>
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
          {connected ? "연결됨" : "연결 끊김"}
        </span>
      </div>

      {/* 에이전트 상태바 */}
      <AgentStatusBar
        statuses={agentStatuses}
        selected={selectedAgent}
        onSelect={(id) => dispatch({ type: "SELECT_AGENT", agentId: id })}
      />

      {/* 3패널 */}
      <div className="flex flex-1 overflow-hidden divide-x divide-gray-800">
        <div className="w-1/3 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-800">
            Task Board
          </div>
          <div className="h-[calc(100%-33px)] overflow-y-auto">
            <TaskBoard tasks={tasks} />
          </div>
        </div>
        <div className="w-1/3 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-gray-800">
            Message Feed
          </div>
          <div className="h-[calc(100%-33px)] overflow-y-auto">
            <MessageFeed messages={messages} />
          </div>
        </div>
        <div className="w-1/3 overflow-hidden">
          <AgentThoughts
            agentId={selectedAgent}
            chunks={selectedAgent ? (thinkingChunks[selectedAgent] ?? "") : ""}
          />
        </div>
      </div>
    </div>
  );
}
