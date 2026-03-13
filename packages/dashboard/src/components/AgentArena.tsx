// packages/dashboard/src/components/AgentArena.tsx
// 왼쪽 패널: 에이전트 카드 목록 (320px 고정 너비)

import { useEffect, useState } from "react";
import type { AgentId } from "../types";
import { AgentCard } from "./AgentCard";

interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
}

interface Props {
  statuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  tasks: Array<{ id: string; assignee: string | null; status: string }>;
  messages: Array<{ id: string; from_agent: string; to_agent: string | null; content: string }>;
  selectedAgent: AgentId | null;
  onSelectAgent: (id: AgentId | null) => void;
}

export function AgentArena({
  statuses,
  thinkingChunks,
  tasks,
  messages,
  selectedAgent,
  onSelectAgent,
}: Props) {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setAgents)
      .catch(() => setError(true));
  }, []);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: 320,
        flexShrink: 0,
        borderRight: "1px solid var(--color-border-subtle)",
        background: "var(--color-surface-base)",
      }}
    >
      {/* 패널 헤더 */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 40,
          borderBottom: "1px solid var(--color-border-subtle)",
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
          Agent Arena
        </span>
        {/* 에이전트 수 배지 */}
        {agents.length > 0 && (
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
            {agents.length}
          </span>
        )}
      </div>

      {/* 에이전트 카드 목록 */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 8px" }}>
        {error && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "#ef4444", fontSize: 12 }}
          >
            Failed to load agents
          </div>
        )}

        {!error && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full" style={{ gap: 8 }}>
            <span style={{ fontSize: 24, opacity: 0.3 }}>👥</span>
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>No agents</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-disabled)",
                textAlign: "center",
                maxWidth: 180,
              }}
            >
              Define agents in agents.yml
            </span>
          </div>
        )}

        {agents.map((agent) => {
          // 해당 에이전트의 진행 중 태스크 수
          const inProgressCount = tasks.filter(
            (t) =>
              t.assignee === agent.id && (t.status === "in_progress" || t.status === "in_review")
          ).length;

          // 마지막으로 받은 메시지 미리보기
          const lastMessage = messages.find(
            (m) => m.from_agent === agent.id || m.to_agent === agent.id
          );

          // 현재 thinking chunk
          const thinkingChunk = thinkingChunks[agent.id] ?? "";

          return (
            <AgentCard
              key={agent.id}
              id={agent.id}
              name={agent.name}
              emoji={agent.emoji}
              status={statuses[agent.id] ?? "idle"}
              thinkingChunk={thinkingChunk}
              lastMessage={lastMessage?.content ?? null}
              inProgressCount={inProgressCount}
              isSelected={selectedAgent === agent.id}
              onClick={() => onSelectAgent(selectedAgent === agent.id ? null : agent.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
