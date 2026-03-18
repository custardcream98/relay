// packages/dashboard/src/components/activity/MessageBroadcastEntry.tsx
// [A] Broadcast message card

import { memo } from "react";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { MarkdownContent } from "../MarkdownContent";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { ROW_BASE, SLIDE_IN } from "./constants";
import { EndDeclarationEntry } from "./EndDeclarationEntry";
import { getEndDeclarationType } from "./helpers";

export const MessageBroadcastEntry = memo(function MessageBroadcastEntry({
  entry,
}: {
  entry: TimelineEntry;
}) {
  if (!entry.agentId || !entry.detail) return null;

  const endType = getEndDeclarationType(entry.detail);
  if (endType)
    return (
      <EndDeclarationEntry agentId={entry.agentId} endType={endType} timestamp={entry.timestamp} />
    );

  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <AgentChip agentId={entry.agentId} />
          <span className="font-mono text-[10px] text-(--color-text-disabled) bg-(--color-surface-overlay) px-[5px] py-px rounded-[3px]">
            broadcast
          </span>
          <span className="font-mono text-[10px] text-(--color-text-disabled) ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <MarkdownContent text={entry.detail} />
      </div>
    </div>
  );
});
