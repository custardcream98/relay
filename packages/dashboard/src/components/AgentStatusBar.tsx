// packages/dashboard/src/components/AgentStatusBar.tsx
import { useEffect, useState } from "react";
import type { AgentId } from "../types";

interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
}

interface Props {
  statuses: Partial<Record<AgentId, "idle" | "working" | "waiting">>;
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
}

const AGENT_ACCENT: Record<string, string> = {
  pm: "text-purple-400",
  designer: "text-pink-400",
  da: "text-yellow-400",
  fe: "text-blue-400",
  be: "text-emerald-400",
  qa: "text-orange-400",
  deployer: "text-orange-400",
};

export function AgentStatusBar({ statuses, selected, onSelect }: Props) {
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

  if (error) {
    return (
      <div className="h-9 flex items-center px-4 border-b border-zinc-800">
        <span className="text-[11px] text-red-400">Failed to load agents</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-3 border-b border-zinc-800 h-9 overflow-x-auto">
      {agents.map(({ id, name, emoji }) => {
        const status = statuses[id] ?? "idle";
        const isWorking = status === "working";
        const isWaiting = status === "waiting";
        const isSelected = selected === id;
        const accent = AGENT_ACCENT[id] ?? "text-zinc-400";

        return (
          <button
            type="button"
            key={id}
            onClick={() => onSelect(id)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all
              ${isSelected ? "bg-zinc-800" : "hover:bg-zinc-900"}
              ${isWorking ? accent : "text-zinc-500"}
            `}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span>{name}</span>
            {/* Status dot */}
            <span
              className={`
                w-1.5 h-1.5 rounded-full flex-shrink-0
                ${isWorking ? "bg-emerald-400 animate-pulse" : ""}
                ${isWaiting ? "bg-yellow-500" : ""}
                ${!isWorking && !isWaiting ? "bg-zinc-700" : ""}
              `}
            />
          </button>
        );
      })}
    </div>
  );
}
