// packages/dashboard/src/components/activity/CollapsedGroup.tsx
// Renders a group of consecutive same-type entries, collapsing when >= 3 entries.

import { memo, useState } from "react";
import type { TimelineEntry } from "../../types";
import { EntryRenderer } from "./EntryRenderer";

export interface EntryGroup {
  entries: TimelineEntry[];
  collapsed: boolean;
}

/**
 * Group consecutive entries by (agentId, type).
 * A time gap > 60s also breaks a group (aligns with TimeSeparator boundaries).
 */
export function groupConsecutive(entries: TimelineEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    const lastEntry = last?.entries[last.entries.length - 1];
    // Break group on different agent, different type, or >60s gap
    if (
      last &&
      last.entries[0].agentId === entry.agentId &&
      last.entries[0].type === entry.type &&
      lastEntry &&
      entry.timestamp - lastEntry.timestamp <= 60_000
    ) {
      last.entries.push(entry);
      last.collapsed = last.entries.length >= 3;
    } else {
      groups.push({ entries: [entry], collapsed: false });
    }
  }
  return groups;
}

export const CollapsedGroup = memo(function CollapsedGroup({
  group,
  focusedIndex,
  globalOffset,
  expandedEntries,
  onClickArtifact,
}: {
  group: EntryGroup;
  /** Index of the focused entry in the full filtered list (-1 = none) */
  focusedIndex: number;
  /** Offset of this group's first entry in the full filtered list */
  globalOffset: number;
  expandedEntries: Set<string>;
  onClickArtifact?: (artifactId: string, rect: DOMRect) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Not collapsed or user expanded — render all entries
  if (!group.collapsed || expanded) {
    return (
      <>
        {group.entries.map((entry, i) => (
          <EntryRenderer
            key={entry.id}
            entry={entry}
            isFocused={focusedIndex === globalOffset + i}
            entryId={`activity-entry-${entry.id}`}
            isExpanded={expandedEntries.has(entry.id)}
            onClickArtifact={onClickArtifact}
          />
        ))}
      </>
    );
  }

  // Collapsed view: first + "+N more" button + last
  const first = group.entries[0];
  const last = group.entries[group.entries.length - 1];
  return (
    <>
      <EntryRenderer
        entry={first}
        isFocused={focusedIndex === globalOffset}
        entryId={`activity-entry-${first.id}`}
        isExpanded={expandedEntries.has(first.id)}
        onClickArtifact={onClickArtifact}
      />
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs text-(--color-text-secondary) pl-10 py-0.5 hover:underline cursor-pointer"
      >
        +{group.entries.length - 2} more
      </button>
      <EntryRenderer
        entry={last}
        isFocused={focusedIndex === globalOffset + group.entries.length - 1}
        entryId={`activity-entry-${last.id}`}
        isExpanded={expandedEntries.has(last.id)}
        onClickArtifact={onClickArtifact}
      />
    </>
  );
});
