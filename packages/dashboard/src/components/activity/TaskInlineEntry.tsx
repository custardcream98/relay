// packages/dashboard/src/components/activity/TaskInlineEntry.tsx
// [D] Task status change — inline pill, minimal visual weight

import { memo } from "react";
import { getAgentAccent } from "../../constants/agents";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { SLIDE_IN } from "./constants";

export const TaskInlineEntry = memo(function TaskInlineEntry({ entry }: { entry: TimelineEntry }) {
  const accentColor = entry.agentId ? getAgentAccent(entry.agentId) : "var(--color-text-disabled)";

  let icon = "📋";
  const desc = entry.description.toLowerCase();
  if (desc.includes("done")) icon = "✅";
  else if (desc.includes("in progress") || desc.includes("claimed")) icon = "🔄";
  else if (desc.includes("in review")) icon = "👁";
  else if (desc.includes("todo")) icon = "⬜";

  return (
    <div className={cn("flex items-center gap-1.5 px-5 py-[5px]", SLIDE_IN)}>
      <span className="text-[12px]">{icon}</span>
      {entry.agentId && (
        <span className="font-mono text-[10px] font-semibold" style={{ color: accentColor }}>
          {entry.agentId}
        </span>
      )}
      <span className="text-[11px] text-(--color-text-tertiary) flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {entry.description}
      </span>
      <span className="font-mono text-[10px] text-(--color-text-disabled) shrink-0">
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  );
});
