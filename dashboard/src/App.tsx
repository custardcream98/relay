// dashboard/src/App.tsx
import { useReducer, useEffect } from "react";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { TaskBoard } from "./components/TaskBoard";
import { MessageFeed } from "./components/MessageFeed";
import { AgentThoughts } from "./components/AgentThoughts";
import type { AgentId, RelayEvent } from "./types";

const WS_URL = `ws://${window.location.host}/ws`;

// 대시보드 파생 상태 타입
interface DashboardState {
  tasks: Array<{ id: string; title: string; assignee: string | null; status: string; priority: string }>;
  messages: Array<{ id: string; from_agent: string; to_agent: string | null; content: string; created_at: number }>;
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  thinkingChunks: Partial<Record<AgentId, string[]>>;
  selectedAgent: AgentId | null;
}

type Action =
  | { type: "SNAPSHOT"; snapshot: { tasks: unknown[]; messages: unknown[]; artifacts: unknown[] } }
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
    case "SNAPSHOT":
      return {
        ...state,
        tasks: action.snapshot.tasks as DashboardState["tasks"],
        messages: action.snapshot.messages as DashboardState["messages"],
      };
    case "SELECT_AGENT":
      return { ...state, selectedAgent: action.agentId };
    case "EVENT": {
      const event = action.event;
      if (event.type === "task:updated") {
        const idx = state.tasks.findIndex(t => t.id === event.task.id);
        const tasks = idx >= 0
          ? state.tasks.map((t, i) => i === idx ? { ...t, ...event.task } : t)
          : [...state.tasks, event.task];
        return { ...state, tasks };
      }
      if (event.type === "message:new") {
        return { ...state, messages: [...state.messages, event.message] };
      }
      if (event.type === "agent:status") {
        return { ...state, agentStatuses: { ...state.agentStatuses, [event.agentId]: event.status } };
      }
      if (event.type === "agent:thinking") {
        const prev = state.thinkingChunks[event.agentId] ?? [];
        return {
          ...state,
          thinkingChunks: { ...state.thinkingChunks, [event.agentId]: [...prev, event.chunk] },
        };
      }
      if (event.type === "session:snapshot") {
        return {
          ...state,
          tasks: event.tasks as DashboardState["tasks"],
          messages: event.messages as DashboardState["messages"],
        };
      }
      return state;
    }
  }
}

export default function App() {
  const { events, connected } = useRelaySocket(WS_URL);
  const [state, dispatch] = useReducer(reducer, initialState);

  // 초기 스냅샷 로드
  useEffect(() => {
    fetch("/api/session")
      .then(r => r.json())
      .then(snapshot => dispatch({ type: "SNAPSHOT", snapshot }))
      .catch(console.error);
  }, []);

  // WebSocket 이벤트를 reducer로 전달 (마지막으로 처리한 이벤트만)
  useEffect(() => {
    if (events.length === 0) return;
    dispatch({ type: "EVENT", event: events[events.length - 1] });
  }, [events]);

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
            chunks={selectedAgent ? (thinkingChunks[selectedAgent] ?? []) : []}
          />
        </div>
      </div>
    </div>
  );
}
