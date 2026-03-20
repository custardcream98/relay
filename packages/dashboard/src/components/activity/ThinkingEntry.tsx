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
        "border border-dashed border-(--color-thinking-border) bg-(--color-thinking-bg)",
        "mx-3 my-1 rounded-[6px]",
        SLIDE_IN
      )}
      style={containerStyle}
    >
      <AgentAvatar agentId={agentId} size={28} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <AgentChip agentId={agentId} />
          <span style={thinkingLabelStyle} className="italic">
            thinking…
          </span>
          <span className="ml-auto font-mono text-[10px] text-(--color-text-disabled)">
            {isLive ? "live" : ""}
          </span>
        </div>
        <p className="m-0 font-mono text-[11px] leading-[1.6] wrap-break-word whitespace-pre-wrap text-(--color-text-secondary)">
          {chunk}
          {isLive && (
            <span
              className="ml-[2px] inline-block h-[11px] w-[5px] align-text-bottom"
              style={{ background: accentColor, animation: "blink 1.2s step-end infinite" }}
            />
          )}
        </p>
      </div>
    </div>
  );
});
