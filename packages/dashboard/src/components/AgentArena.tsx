// packages/dashboard/src/components/AgentArena.tsx
// Left panel: agent card list — collapsible and drag-resizable

import { useMemo } from "react";
import type { AgentId, AgentMeta, Message, Task } from "../types";
import { AgentCard } from "./AgentCard";

interface Props {
  agents: AgentMeta[];
  agentsLoading: boolean;
  agentsError: boolean;
  statuses: Partial<Record<AgentId, "idle" | "working" | "waiting" | "done">>;
  thinkingChunks: Partial<Record<AgentId, string>>;
  tasks: Task[];
  messages: Message[];
  selectedAgent: AgentId | null;
  onSelectAgent: (id: AgentId | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function AgentArena({
  agents,
  agentsLoading,
  agentsError,
  statuses,
  thinkingChunks,
  tasks,
  messages,
  selectedAgent,
  onSelectAgent,
  collapsed,
  onToggleCollapse,
}: Props) {
  // Pre-compute per-agent task counts and last activity — avoids repeated iteration on each render
  const agentData = useMemo(() => {
    const inProgressByAgent: Record<string, number> = {};
    // Most recent assigned task title per agent (used as fallback activity text)
    const lastTaskByAgent: Record<string, string> = {};
    for (const t of tasks) {
      if (t.assignee) {
        if (t.status === "in_progress" || t.status === "in_review") {
          inProgressByAgent[t.assignee] = (inProgressByAgent[t.assignee] ?? 0) + 1;
        }
        lastTaskByAgent[t.assignee] = `Task: ${t.title}`;
      }
    }

    const lastMessageByAgent: Record<string, string> = {};
    for (const m of messages) {
      if (!lastMessageByAgent[m.from_agent]) lastMessageByAgent[m.from_agent] = m.content;
      if (m.to_agent && !lastMessageByAgent[m.to_agent]) lastMessageByAgent[m.to_agent] = m.content;
    }

    // Unified activity: prefer last message, fall back to last task assignment
    const lastActivityByAgent: Record<string, string> = {
      ...lastTaskByAgent,
      ...lastMessageByAgent,
    };

    return { inProgressByAgent, lastActivityByAgent };
  }, [tasks, messages]);

  // Collapsed: render only a thin rail
  if (collapsed) {
    return (
      <div
        className="flex flex-col h-full items-center"
        style={{
          width: 32,
          borderRight: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand panel"
          style={{
            marginTop: 8,
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-disabled)",
            fontSize: 12,
          }}
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        borderRight: "1px solid var(--color-border-subtle)",
        background: "var(--color-surface-base)",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Agent count badge */}
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
          {/* Collapse button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse panel"
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
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            ‹
          </button>
        </div>
      </div>

      {/* Agent card list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 8px" }}>
        {agentsError && (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "#ef4444", fontSize: 12 }}
          >
            Failed to load agents
          </div>
        )}

        {/* Loading skeleton */}
        {!agentsError && agentsLoading && (
          <div className="flex flex-col gap-2" style={{ padding: 4 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 64,
                  borderRadius: 8,
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-subtle)",
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        )}

        {/* No agents (after load completes) */}
        {!agentsError && !agentsLoading && agents.length === 0 && (
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
              Define agents in agents.pool.yml
            </span>
          </div>
        )}

        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            id={agent.id}
            name={agent.name}
            emoji={agent.emoji}
            status={statuses[agent.id] ?? "idle"}
            thinkingChunk={thinkingChunks[agent.id] ?? ""}
            lastMessage={agentData.lastActivityByAgent[agent.id] ?? null}
            inProgressCount={agentData.inProgressByAgent[agent.id] ?? 0}
            isSelected={selectedAgent === agent.id}
            onClick={() => onSelectAgent(selectedAgent === agent.id ? null : agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
