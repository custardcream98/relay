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
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-(--color-text-tertiary)">submitted review</span>
          <span className="ml-auto font-mono text-[10px] text-(--color-text-disabled)">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="rounded-[5px] border border-(--color-border-default) bg-(--color-surface-raised) px-[10px] py-[7px] text-xs text-(--color-text-secondary)">
          {entry.description}
          {entry.detail && (
            <p className="mt-1 mb-0 text-[11px] wrap-break-word whitespace-pre-wrap text-(--color-text-tertiary)">
              {entry.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
