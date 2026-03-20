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

  // Dynamic color values require inline styles — Tailwind arbitrary values don't support runtime hex
  const style = useMemo(
    () => ({
      width: size,
      height: size,
      fontSize: size * 0.38,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
    }),
    [color, size]
  );

  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-mono font-bold tracking-[-0.02em] select-none"
      style={style}
    >
      {agentId.slice(0, 2).toUpperCase()}
    </div>
  );
}
