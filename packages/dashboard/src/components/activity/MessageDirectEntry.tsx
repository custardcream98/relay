// packages/dashboard/src/components/activity/MessageDirectEntry.tsx
// [B] Direct message card — left accent bar, tinted background
import { memo, useMemo } from "react";

import { getAgentAccent } from "../../constants/agents";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { MarkdownContent } from "../MarkdownContent";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { ROW_BASE, SLIDE_IN } from "./constants";

export const MessageDirectEntry = memo(function MessageDirectEntry({
  entry,
  toAgent,
}: {
  entry: TimelineEntry;
  toAgent: string;
}) {
  const toColor = getAgentAccent(toAgent);

  // Dynamic border/background from runtime hex — must stay inline
  const containerStyle = useMemo(
    () => ({
      background: `${toColor}06`,
      borderLeft: `2px solid ${toColor}`,
    }),
    [toColor]
  );

  if (!entry.agentId || !entry.detail) return null;

  return (
    <div className={cn(ROW_BASE, SLIDE_IN)} style={containerStyle}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[10px] text-(--color-text-disabled)">→</span>
          <AgentChip agentId={toAgent} />
          <span className="ml-auto font-mono text-[10px] text-(--color-text-disabled)">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <MarkdownContent text={entry.detail} />
      </div>
    </div>
  );
});
