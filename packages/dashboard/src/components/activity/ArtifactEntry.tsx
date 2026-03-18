// packages/dashboard/src/components/activity/ArtifactEntry.tsx
// [E] Artifact posted card

import { memo } from "react";
import { cn } from "../../lib/cn";
import type { TimelineEntry } from "../../types";
import { relativeTime } from "../../utils/time";
import { AgentAvatar } from "../shared/AgentAvatar";
import { AgentChip } from "../shared/AgentChip";
import { ROW_BASE, SLIDE_IN } from "./constants";

export const ArtifactEntry = memo(function ArtifactEntry({
  entry,
  onClickArtifact,
}: {
  entry: TimelineEntry;
  onClickArtifact?: (artifactId: string, rect: DOMRect) => void;
}) {
  if (!entry.agentId) return null;
  const artifactId = entry.detail;
  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-(--color-text-tertiary)">posted artifact</span>
          <span className="font-mono text-[10px] text-(--color-text-disabled) ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-[10px] py-1.5 bg-(--color-surface-raised) border border-(--color-border-default) rounded-[5px] max-w-full cursor-pointer transition-[border-color,background] duration-100 hover:border-(--color-accent) hover:bg-(--color-surface-overlay)"
          onClick={(e) => {
            if (artifactId) onClickArtifact?.(artifactId, e.currentTarget.getBoundingClientRect());
          }}
        >
          <span className="text-sm">📄</span>
          <span className="font-mono text-[11px] text-(--color-text-primary) overflow-hidden text-ellipsis whitespace-nowrap">
            {entry.description.replace(/^Artifact: /, "")}
          </span>
        </button>
      </div>
    </div>
  );
});
