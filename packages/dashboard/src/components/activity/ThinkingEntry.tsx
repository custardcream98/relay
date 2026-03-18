// packages/dashboard/src/components/activity/ThinkingEntry.tsx
// [C] Agent thinking card — dashed border, streaming text, blinking cursor

import { memo, useMemo } from "react";
import { getAgentAccent } from "../../constants/agents";
import { cn } from "../../lib/cn";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { SLIDE_IN } from "./constants";

export const ThinkingEntry = memo(function ThinkingEntry({
  agentId,
  chunk,
  isLive,
}: {
  agentId: string;
  chunk: string;
  isLive: boolean;
}) {
  const accentColor = getAgentAccent(agentId);

  const containerStyle = useMemo(
    () => ({ borderLeft: `2px dashed ${accentColor}40` }),
    [accentColor]
  );

  const thinkingLabelStyle = useMemo(
    () => ({ fontSize: 10, color: accentColor, opacity: 0.8 }),
    [accentColor]
  );

  return (
    <div
      className={cn(
        "flex gap-[10px] px-4 py-[10px]",
        "bg-(--color-thinking-bg) border border-dashed border-(--color-thinking-border)",
        "mx-3 my-1 rounded-[6px]",
        SLIDE_IN
      )}
      style={containerStyle}
    >
      <AgentAvatar agentId={agentId} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <AgentChip agentId={agentId} />
          <span style={thinkingLabelStyle} className="italic">
            thinking…
          </span>
          <span className="font-mono text-[10px] text-(--color-text-disabled) ml-auto">
            {isLive ? "live" : ""}
          </span>
        </div>
        <p className="text-[11px] leading-[1.6] text-(--color-text-secondary) m-0 font-mono whitespace-pre-wrap wrap-break-word">
          {chunk}
          {isLive && (
            <span
              className="inline-block w-[5px] h-[11px] ml-[2px] align-text-bottom"
              style={{ background: accentColor, animation: "blink 1.2s step-end infinite" }}
            />
          )}
        </p>
      </div>
    </div>
  );
});
