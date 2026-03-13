// dashboard/src/components/AgentStatusBar.tsx
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

export function AgentStatusBar({ statuses, selected, onSelect }: Props) {
  const [agents, setAgents] = useState<AgentMeta[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => setAgents(data as AgentMeta[]));
  }, []);

  return (
    <div className="flex gap-3 p-3 bg-gray-900 border-b border-gray-700">
      {agents.map(({ id, name, emoji }) => {
        const status = statuses[id] ?? "idle";
        const isWorking = status === "working";
        const isSelected = selected === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
              ${isSelected ? "ring-2 ring-blue-400" : ""}
              ${isWorking ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}
          >
            <span>{emoji}</span>
            <span>{name}</span>
            <span
              className={`w-2 h-2 rounded-full ${isWorking ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
