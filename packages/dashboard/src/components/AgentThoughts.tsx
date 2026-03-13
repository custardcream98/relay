// packages/dashboard/src/components/AgentThoughts.tsx
import type { AgentId } from "@custardcream/relay-shared";
import { useEffect, useRef } from "react";

interface Props {
  agentId: AgentId | null;
  chunks: string;
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

export function AgentThoughts({ agentId, chunks }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on chunks change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  const accent = agentId ? (AGENT_ACCENT[agentId] ?? "text-zinc-400") : "text-zinc-600";

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="h-[33px] flex items-center px-4 border-b border-zinc-800">
        <span className={`text-[10px] font-medium uppercase tracking-widest ${accent}`}>
          {agentId ? `${agentId}` : "Agent Thoughts"}
        </span>
        {agentId && chunks.length > 0 && (
          <span className="ml-2 text-[10px] text-zinc-700">thinking</span>
        )}
      </div>

      {/* Terminal area */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-[12px] leading-relaxed text-emerald-300/90">
        {!agentId && (
          <span className="text-zinc-700 text-[11px] uppercase tracking-wider">
            Select an agent to see its thoughts
          </span>
        )}
        {agentId && chunks.length === 0 && (
          <span className="text-zinc-700">
            <span className="animate-pulse">_</span>
          </span>
        )}
        {chunks}
        {chunks.length > 0 && (
          <span className="inline-block w-[7px] h-[14px] bg-emerald-400/80 animate-pulse ml-0.5 align-text-bottom" />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
