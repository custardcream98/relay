// packages/dashboard/src/components/AgentArena.tsx
// Left panel: agent card list — collapsible and drag-resizable

import { useMemo } from "react";
import { useSession } from "../context/SessionContext";
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
    const lastActivityRaw: Record<string, { label: string; ts: number }> = {};

    const updateActivity = (agentId: string, label: string, ts: number) => {
      if (!lastActivityRaw[agentId] || ts > lastActivityRaw[agentId].ts) {
        lastActivityRaw[agentId] = { label, ts };
      }
    };

    for (const t of tasks) {
      if (t.assignee) {
        if (t.status === "in_progress" || t.status === "in_review") {
          inProgressByAgent[t.assignee] = (inProgressByAgent[t.assignee] ?? 0) + 1;
        }
        const taskTs = (t.updated_at ?? t.created_at ?? 0) * 1000;
        updateActivity(t.assignee, `Task: ${t.title}`, taskTs);
      }
    }

    for (const m of messages) {
      const msgTs = m.created_at * 1000;
      updateActivity(m.from_agent, m.content, msgTs);
      if (m.to_agent) updateActivity(m.to_agent, m.content, msgTs);
    }

    const lastActivityByAgent: Record<string, string> = {};
    const lastActivityTsByAgent: Record<string, number> = {};
    for (const [agentId, { label, ts }] of Object.entries(lastActivityRaw)) {
      lastActivityByAgent[agentId] = label;
      lastActivityTsByAgent[agentId] = ts;
    }

    return { inProgressByAgent, lastActivityByAgent, lastActivityTsByAgent };
  }, [tasks, messages]);

  // Lookup joinedAt from sessionTeam for newly-joined agent highlight
  const { sessionTeam } = useSession();
  const joinedAtByAgent = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const a of sessionTeam) {
      map[a.id] = a.joinedAt ?? null;
    }
    return map;
  }, [sessionTeam]);

  return (
    <div className="flex flex-col h-full overflow-hidden border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 shrink-0 h-10 border-b border-[var(--color-border-subtle)]">
        <span className="text-[10px] font-medium text-[var(--color-text-disabled)] uppercase tracking-[0.07em]">
          Agent Arena
        </span>
        {agents.length > 0 && (
          <span className="font-mono text-[10px] bg-[var(--color-surface-overlay)] text-[var(--color-text-tertiary)] px-1.5 py-[1px] rounded-full">
            {agents.length}
          </span>
        )}
      </div>

      {/* Agent card list */}
      <div className="flex-1 overflow-y-auto p-2">
        {agentsError && (
          <div className="flex items-center justify-center h-full text-[var(--color-end-failed)] text-xs">
            Failed to load agents
          </div>
        )}

        {/* Loading skeleton */}
        {!agentsError && agentsLoading && (
          <div className="flex flex-col gap-2 p-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] opacity-40"
              />
            ))}
          </div>
        )}

        {/* No agents (after load completes) */}
        {!agentsError && !agentsLoading && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-[10px]">
            <span className="text-[28px] opacity-20">👥</span>
            <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
              No agents yet
            </span>
            <span className="text-[11px] text-[var(--color-text-disabled)] text-center max-w-[190px] leading-[1.5]">
              Start a{" "}
              <span className="font-mono text-[var(--color-text-tertiary)] text-[10px]">
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
            onSelectAgent={onSelectAgent}
            joinedAt={joinedAtByAgent[agent.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
