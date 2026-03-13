// dashboard/src/components/AgentThoughts.tsx
import type { AgentId } from "../types";

interface Props {
  agentId: AgentId | null;
  chunks: string[]; // 선택된 에이전트의 thinking 청크 누적
}

export function AgentThoughts({ agentId, chunks }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase">
          {agentId ? `${agentId} 생각 중...` : "에이전트를 선택하세요"}
        </span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto font-mono text-sm text-green-300 leading-relaxed">
        {chunks.join("")}
        {chunks.length > 0 && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
        )}
        {chunks.length === 0 && agentId && (
          <span className="text-gray-600">대기 중...</span>
        )}
      </div>
    </div>
  );
}
