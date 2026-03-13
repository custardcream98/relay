// dashboard/src/App.tsx
import { useState, useMemo, useEffect } from "react";
import { useRelaySocket } from "./hooks/useRelaySocket";
import { AgentStatusBar } from "./components/AgentStatusBar";
import { TaskBoard } from "./components/TaskBoard";
import { MessageFeed } from "./components/MessageFeed";
import { AgentThoughts } from "./components/AgentThoughts";
import type { AgentId, RelayEvent } from "./types";

const WS_URL = `ws://${window.location.host}/ws`;

// 세션 스냅샷 타입 (서버에서 내려오는 초기 데이터)
interface SessionSnapshot {
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
  artifacts: unknown[];
}

export default function App() {
  const { events, connected } = useRelaySocket(WS_URL);
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    tasks: [],
    messages: [],
    artifacts: [],
  });

  // 초기 스냅샷 로드
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => setSnapshot(data as SessionSnapshot));
  }, []);

  // 이벤트 누적으로 상태 파생
  const { tasks, messages, agentStatuses, thinkingChunks } = useMemo(() => {
    let tasks = [...snapshot.tasks];
    let messages = [...snapshot.messages];
    const agentStatuses: Partial<
      Record<AgentId, "idle" | "working" | "waiting">
    > = {};
    const thinkingChunks: Partial<Record<AgentId, string[]>> = {};

    for (const event of events) {
      if (event.type === "task:updated") {
        const idx = tasks.findIndex((t) => t.id === event.task.id);
        if (idx >= 0) tasks[idx] = { ...tasks[idx], ...event.task };
        else tasks.push(event.task);
      } else if (event.type === "message:new") {
        messages.push(event.message);
      } else if (event.type === "agent:status") {
        agentStatuses[event.agentId] = event.status;
      } else if (event.type === "agent:thinking") {
        if (!thinkingChunks[event.agentId]) thinkingChunks[event.agentId] = [];
        thinkingChunks[event.agentId]!.push(event.chunk);
      } else if (event.type === "session:snapshot") {
        // 전체 상태를 서버 스냅샷으로 교체 (재연결 시 동기화)
        const snapshotEvent = event as Extract<
          RelayEvent,
          { type: "session:snapshot" }
        >;
        tasks = [
          ...(snapshotEvent.tasks as typeof tasks),
        ];
        messages = [
          ...(snapshotEvent.messages as typeof messages),
        ];
      }
    }

    return { tasks, messages, agentStatuses, thinkingChunks };
  }, [events, snapshot]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="font-bold text-lg">relay</span>
        <span
          className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
        >
          {connected ? "연결됨" : "연결 끊김"}
        </span>
      </div>

      {/* 에이전트 상태바 */}
      <AgentStatusBar
        statuses={agentStatuses}
        selected={selectedAgent}
        onSelect={setSelectedAgent}
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
            chunks={
              selectedAgent ? (thinkingChunks[selectedAgent] ?? []) : []
            }
          />
        </div>
      </div>
    </div>
  );
}
