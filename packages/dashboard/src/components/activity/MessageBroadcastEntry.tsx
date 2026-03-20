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
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="rounded-[3px] bg-(--color-surface-overlay) px-[5px] py-px font-mono text-[10px] text-(--color-text-disabled)">
            broadcast
          </span>
          <span className="ml-auto font-mono text-[10px] text-(--color-text-disabled)">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <MarkdownContent text={entry.detail} />
      </div>
    </div>
  );
});
