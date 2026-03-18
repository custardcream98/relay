// packages/dashboard/src/components/activity/ReviewEntry.tsx
// [F] Review requested card — amber action card

import { memo } from "react";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { ROW_BASE, SLIDE_IN } from "./constants";

export const ReviewEntry = memo(function ReviewEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-(--color-text-tertiary)">requested review</span>
          <span className="font-mono text-[10px] text-(--color-text-disabled) ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="px-[10px] py-[7px] bg-(--color-review-bg) border border-(--color-review-border) rounded-[5px] text-xs text-(--color-end-waiting)">
          <span className="mr-1.5">⚠</span>
          {entry.description}
        </div>
      </div>
    </div>
  );
});
