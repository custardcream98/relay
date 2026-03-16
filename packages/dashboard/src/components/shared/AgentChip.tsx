// packages/dashboard/src/components/shared/AgentChip.tsx
// Shared agent name chip — colored mono text badge.

import { useMemo } from "react";
import { getAgentAccent } from "../../constants/agents";

interface Props {
  agentId: string;
}

export function AgentChip({ agentId }: Props) {
  const color = getAgentAccent(agentId);

  // Stable style object — recomputed only when agentId changes
  const style = useMemo(
    () => ({
      fontSize: 11,
      fontWeight: 600,
      color,
      background: `${color}18`,
      padding: "1px 5px",
      borderRadius: 3,
      flexShrink: 0,
    }),
    [color]
  );

  return (
    <span className="font-mono" style={style}>
      {agentId}
    </span>
  );
}
