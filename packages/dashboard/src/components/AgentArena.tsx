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
    const taskDoneByAgent: Record<string, number> = {};
    const taskTotalByAgent: Record<string, number> = {};
    const lastActivityRaw: Record<string, { label: string; ts: number }> = {};

    const updateActivity = (agentId: string, label: string, ts: number) => {
      if (!lastActivityRaw[agentId] || ts > lastActivityRaw[agentId].ts) {
        lastActivityRaw[agentId] = { label, ts };
      }
    };

    for (const t of tasks) {
      if (t.assignee) {
        taskTotalByAgent[t.assignee] = (taskTotalByAgent[t.assignee] ?? 0) + 1;
        if (t.status === "done") {
          taskDoneByAgent[t.assignee] = (taskDoneByAgent[t.assignee] ?? 0) + 1;
        }
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

    return {
      inProgressByAgent,
      taskDoneByAgent,
      taskTotalByAgent,
      lastActivityByAgent,
      lastActivityTsByAgent,
    };
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
    <div className="flex h-full flex-col overflow-hidden border-r border-(--color-border-subtle) bg-(--color-surface-base)">
      {/* Panel header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-(--color-border-subtle) px-4">
        <span className="text-[10px] font-medium tracking-[0.07em] text-(--color-text-disabled) uppercase">
          Agent Arena
        </span>
        {agents.length > 0 && (
          <span className="rounded-full bg-(--color-surface-overlay) px-1.5 py-px font-mono text-[10px] text-(--color-text-tertiary)">
            {agents.length}
          </span>
        )}
      </div>

      {/* Agent card list */}
      <div className="flex-1 overflow-y-auto p-2">
        {agentsError && (
          <div className="flex h-full items-center justify-center text-xs text-(--color-end-failed)">
            Failed to load agents
          </div>
        )}

        {/* Loading skeleton */}
        {!agentsError && agentsLoading && (
          <div className="flex flex-col gap-2 p-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) opacity-40"
              />
            ))}
          </div>
        )}

        {/* No agents (after load completes) */}
        {!agentsError && !agentsLoading && agents.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-[10px]">
            <span className="text-[28px] opacity-20">👥</span>
            <span className="text-[13px] font-medium text-(--color-text-secondary)">
              No agents yet
            </span>
            <span className="max-w-[190px] text-center text-[11px] leading-normal text-(--color-text-disabled)">
              Start a{" "}
              <span className="font-mono text-[10px] text-(--color-text-tertiary)">/relay</span>{" "}
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
            taskDoneCount={agentData.taskDoneByAgent[agent.id] ?? 0}
            taskTotalCount={agentData.taskTotalByAgent[agent.id] ?? 0}
            isSelected={selectedAgent === agent.id}
            onSelectAgent={onSelectAgent}
            joinedAt={joinedAtByAgent[agent.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
