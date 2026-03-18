// packages/dashboard/src/components/activity/EndDeclarationEntry.tsx
// [G] End declaration — compact card with avatar for clear agent attribution

import { memo, useMemo } from "react";
import { getAgentAccent } from "../../constants/agents";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../utils/time";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { SLIDE_IN } from "./constants";

export const EndDeclarationEntry = memo(function EndDeclarationEntry({
  agentId,
  endType,
  timestamp,
}: {
  agentId: string;
  endType: "done" | "waiting" | "failed";
  timestamp: number;
}) {
  const colorMap = {
    done: "var(--color-end-done)",
    waiting: "var(--color-end-waiting)",
    failed: "var(--color-end-failed)",
  };
  const iconMap = { done: "✓", waiting: "⏸", failed: "✗" };
  const color = colorMap[endType];
  const agentColor = getAgentAccent(agentId);

  const containerStyle = useMemo(
    () => ({
      borderLeft: `2px solid ${agentColor}50`,
      background: `${agentColor}08`,
    }),
    [agentColor]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 border-b border-(--color-border-subtle)",
        SLIDE_IN
      )}
      style={containerStyle}
    >
      <AgentAvatar agentId={agentId} size={22} />
      <AgentChip agentId={agentId} />
      <span className="text-[11px] font-semibold" style={{ color }}>
        {iconMap[endType]}
      </span>
      <span className="text-[11px] text-(--color-text-tertiary)">
        {endType === "waiting"
          ? "waiting for team"
          : endType === "done"
            ? "work complete"
            : "work failed"}
      </span>
      <span className="font-mono text-[10px] text-(--color-text-disabled) ml-auto">
        {relativeTime(timestamp)}
      </span>
    </div>
  );
});
