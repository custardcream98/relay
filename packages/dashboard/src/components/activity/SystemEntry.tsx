// packages/dashboard/src/components/activity/SystemEntry.tsx
// System / status / memory events — tiny inline annotation

import { memo } from "react";
import { getAgentAccent } from "../../constants/agents";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { SLIDE_IN } from "./constants";

export const SystemEntry = memo(function SystemEntry({ entry }: { entry: TimelineEntry }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5 px-5 py-[3px]", SLIDE_IN)}>
      <span className="text-[10px] text-(--color-text-disabled)">
        {entry.agentId && (
          <span
            className="font-mono font-semibold"
            style={{ color: getAgentAccent(entry.agentId) }}
          >
            {entry.agentId}{" "}
          </span>
        )}
        {entry.description}
      </span>
      <span className="font-mono text-[9px] text-(--color-text-disabled)">
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  );
});
