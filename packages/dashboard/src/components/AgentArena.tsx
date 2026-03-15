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
}: Props) {
  // Pre-compute per-agent task counts and last activity — avoids repeated iteration on each render
  const agentData = useMemo(() => {
    const inProgressByAgent: Record<string, number> = {};

    // Track both label and timestamp per agent so the most recent activity wins
    const lastActivityRaw: Record<string, { label: string; ts: number }> = {};

    const updateActivity = (agentId: string, label: string, ts: number) => {
      if (!lastActivityRaw[agentId] || ts > lastActivityRaw[agentId].ts) {
        lastActivityRaw[agentId] = { label, ts };
      }
    };

    // Tasks: use updated_at (or created_at) as the activity timestamp
    for (const t of tasks) {
      if (t.assignee) {
        if (t.status === "in_progress" || t.status === "in_review") {
          inProgressByAgent[t.assignee] = (inProgressByAgent[t.assignee] ?? 0) + 1;
        }
        // updated_at / created_at are Unix seconds — convert to ms for uniform comparison
        const taskTs = (t.updated_at ?? t.created_at ?? 0) * 1000;
        updateActivity(t.assignee, `Task: ${t.title}`, taskTs);
      }
    }

    // Messages: created_at is Unix seconds — first-seen wins per agent per direction
    for (const m of messages) {
      const msgTs = m.created_at * 1000;
      updateActivity(m.from_agent, m.content, msgTs);
      if (m.to_agent) updateActivity(m.to_agent, m.content, msgTs);
    }

    // Flatten to label + timestamp maps consumed by AgentCard
    const lastActivityByAgent: Record<string, string> = {};
    const lastActivityTsByAgent: Record<string, number> = {};
    for (const [agentId, { label, ts }] of Object.entries(lastActivityRaw)) {
      lastActivityByAgent[agentId] = label;
      lastActivityTsByAgent[agentId] = ts;
    }

    return { inProgressByAgent, lastActivityByAgent, lastActivityTsByAgent };
  }, [tasks, messages]);

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
          <div className="flex flex-col items-center justify-center h-full" style={{ gap: 10 }}>
            <span style={{ fontSize: 28, opacity: 0.2 }}>👥</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
              No agents yet
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-disabled)",
                textAlign: "center",
                maxWidth: 190,
                lineHeight: 1.5,
              }}
            >
              Start a{" "}
              <span
                className="font-mono"
                style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}
              >
                /relay
              </span>{" "}
              session — agents will appear here
            </span>
          </div>
        )}

        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            id={agent.id}
            name={agent.name}
            emoji={agent.emoji}
            basePersonaId={agent.basePersonaId}
            status={statuses[agent.id] ?? "idle"}
            thinkingChunk={thinkingChunks[agent.id] ?? ""}
            lastMessage={agentData.lastActivityByAgent[agent.id] ?? null}
            lastActivityTs={agentData.lastActivityTsByAgent[agent.id] ?? null}
            inProgressCount={agentData.inProgressByAgent[agent.id] ?? 0}
            isSelected={selectedAgent === agent.id}
            onClick={() => onSelectAgent(selectedAgent === agent.id ? null : agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
