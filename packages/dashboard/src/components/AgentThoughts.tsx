// packages/dashboard/src/components/AgentThoughts.tsx

import type { AgentId } from "@relay/shared";
import { useEffect, useRef } from "react";

interface Props {
  agentId: AgentId | null;
  chunks: string; // Accumulated thinking text for the selected agent
}

export function AgentThoughts({ agentId, chunks }: Props) {
  // Auto-scroll to the bottom when new chunks arrive
  const bottomRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: chunks triggers scroll intentionally
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase">
          {agentId ? `${agentId} thinking...` : "No agent selected"}
        </span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto font-mono text-sm text-green-300 leading-relaxed">
        {chunks}
        {chunks.length > 0 && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
        )}
        {chunks.length === 0 && agentId && <span className="text-gray-600">Waiting...</span>}
        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
