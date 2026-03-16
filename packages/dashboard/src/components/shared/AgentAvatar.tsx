// packages/dashboard/src/components/shared/AgentAvatar.tsx
// Shared agent avatar — circular chip with accent color and first 2 chars of agent_id.
// aria-hidden="true" because the surrounding AgentChip provides the accessible label.

import { useMemo } from "react";
import { getAgentAccent } from "../../constants/agents";

interface Props {
  agentId: string;
  size?: number;
}

export function AgentAvatar({ agentId, size = 28 }: Props) {
  const color = getAgentAccent(agentId);

  // Stable style object — recomputed only when agentId or size changes
  const style = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: "50%",
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.38,
      fontWeight: 700,
      fontFamily: "var(--font-mono)",
      flexShrink: 0,
      letterSpacing: "-0.02em",
      userSelect: "none" as const,
    }),
    [color, size]
  );

  return (
    <div aria-hidden="true" style={style}>
      {agentId.slice(0, 2).toUpperCase()}
    </div>
  );
}
