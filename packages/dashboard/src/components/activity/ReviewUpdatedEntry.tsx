// packages/dashboard/src/components/activity/ReviewUpdatedEntry.tsx
// [F2] Review updated card — outcome of a review (approved/rejected/changes_requested)

import { memo } from "react";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { ROW_BASE, SLIDE_IN } from "./constants";

export const ReviewUpdatedEntry = memo(function ReviewUpdatedEntry({
  entry,
}: {
  entry: TimelineEntry;
}) {
  if (!entry.agentId) return null;
  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-(--color-text-tertiary)">submitted review</span>
          <span className="font-mono text-[10px] text-(--color-text-disabled) ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="px-[10px] py-[7px] bg-(--color-surface-raised) border border-(--color-border-default) rounded-[5px] text-xs text-(--color-text-secondary)">
          {entry.description}
          {entry.detail && (
            <p className="text-[11px] mt-1 mb-0 text-(--color-text-tertiary) whitespace-pre-wrap wrap-break-word">
              {entry.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
