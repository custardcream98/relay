// packages/dashboard/src/components/shared/AgentChip.tsx
// Shared agent name chip — colored mono text badge.
import { useMemo } from "react";

import { getAgentAccent } from "../../constants/agents";

interface Props {
  agentId: string;
}

export function AgentChip({ agentId }: Props) {
  const color = getAgentAccent(agentId);

  // Dynamic hex colors require inline styles
  const style = useMemo(
    () => ({
      color,
      background: `${color}18`,
    }),
    [color]
  );

  return (
    <span
      className="shrink-0 rounded-[3px] px-[5px] py-px font-mono text-[11px] font-semibold"
      style={style}
    >
      {agentId}
    </span>
  );
}
