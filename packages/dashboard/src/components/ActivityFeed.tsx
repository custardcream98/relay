// packages/dashboard/src/components/ActivityFeed.tsx
// Chat-style unified activity feed — replaces EventTimeline + MessageFeed.
// Renders all relay events in chronological order (latest at bottom),
// with event-type-specific visual treatment per designer spec.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServer } from "../context/ServerContext";
import type { AgentId, TimelineEntry } from "../types";
import { ArtifactDetailModal } from "./ArtifactDetailModal";
import type { FilterableType } from "./activity";
import {
  buildDefaultFilters,
  CollapsedGroup,
  EntryRenderer,
  FILTER_DEFS,
  FILTER_STORAGE_KEY,
  FilterBar,
  groupConsecutive,
  ThinkingEntry,
  TimeSeparator,
} from "./activity";

interface Props {
  entries: TimelineEntry[];
  focusAgent: AgentId | null;
  // Live thinking chunks — keyed by agentId, shown as streaming cards
  thinkingChunks: Partial<Record<AgentId, string>>;
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting" | "done">>;
  totalEventCount: number;
}

export function ActivityFeed({
  entries,
  focusAgent,
  thinkingChunks,
  agentStatuses,
  totalEventCount,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Keyboard navigation state — -1 means no entry focused
  const [focusedIndex, setFocusedIndex] = useState(-1);
  // Track expanded entries (for Enter toggle)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Artifact detail modal state
  const { activeServer } = useServer();
  const [artifactModal, setArtifactModal] = useState<{
    artifactId: string;
    rect: DOMRect;
  } | null>(null);
  const handleClickArtifact = useCallback((artifactId: string, rect: DOMRect) => {
    setArtifactModal({ artifactId, rect });
  }, []);

  // Filter state — persisted to localStorage
  const [activeFilters, setActiveFilters] = useState<Set<FilterableType>>(buildDefaultFilters);

  // Refresh relative timestamps every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Persist filter changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...activeFilters]));
    } catch {
      // Ignore storage errors
    }
  }, [activeFilters]);

  // Filter entries — focusAgent AND type filters combined
  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (focusAgent && e.agentId !== focusAgent) return false;
        // Historical thinking entries are filtered by the toggle.
        // Live thinking is always rendered via thinkingChunks below (filter-independent).
        return activeFilters.has(e.type);
      }),
    [entries, focusAgent, activeFilters]
  );

  // Group consecutive same-type entries for collapse
  const groups = useMemo(() => groupConsecutive(filtered), [filtered]);

  // Precompute per-group offsets for keyboard navigation indexing
  const groupOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const group of groups) {
      offsets.push(offset);
      offset += group.entries.length;
    }
    return offsets;
  }, [groups]);

  // Live thinking agents — only show when working and chunk is non-empty
  const thinkingAgents = useMemo(
    () =>
      Object.entries(thinkingChunks)
        .filter(([agentId, chunk]) => {
          if (!chunk) return false;
          if (focusAgent && agentId !== focusAgent) return false;
          // Live thinking is always visible regardless of filter state
          return true;
        })
        .map(([agentId, chunk]) => ({
          agentId,
          chunk: chunk ?? "",
          isLive: agentStatuses[agentId as AgentId] === "working",
        })),
    [thinkingChunks, focusAgent, agentStatuses]
  );

  // Auto-scroll to bottom on new entries, unless user has scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on entry count / thinking change
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setShowScrollBtn(true);
    }
  }, [entries.length, thinkingAgents.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distFromBottom > 80;
    isUserScrollingRef.current = scrolledUp;
    if (!scrolledUp) setShowScrollBtn(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    isUserScrollingRef.current = false;
    setShowScrollBtn(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const toggleFilter = useCallback((type: FilterableType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const allOn = activeFilters.size === FILTER_DEFS.length;
  const toggleAll = useCallback(() => {
    setActiveFilters(allOn ? new Set() : new Set(FILTER_DEFS.map((f) => f.type)));
  }, [allOn]);

  // True empty = no entries at all (not just filtered)
  const hasNoEntries = entries.length === 0 && thinkingAgents.length === 0;
  const isEmpty = filtered.length === 0 && thinkingAgents.length === 0;

  // Per-type event counts for filter badge labels
  const countByType = useMemo(() => {
    const counts: Partial<Record<FilterableType, number>> = {};
    for (const e of entries) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  // Total navigable items: filtered entries + live thinking cards
  const navigableCount = filtered.length + thinkingAgents.length;

  // Reset focused index when filtered list changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on list change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [filtered.length, thinkingAgents.length]);

  // Auto-scroll focused entry into view
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on focus change
  useEffect(() => {
    if (focusedIndex < 0) return;
    const entryId =
      focusedIndex < filtered.length
        ? `activity-entry-${filtered[focusedIndex].id}`
        : `activity-entry-thinking-${thinkingAgents[focusedIndex - filtered.length]?.agentId}`;
    const el = document.getElementById(entryId);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev < navigableCount - 1 ? prev + 1 : prev));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            const entry = filtered[focusedIndex];
            setExpandedEntries((prev) => {
              const next = new Set(prev);
              if (next.has(entry.id)) next.delete(entry.id);
              else next.add(entry.id);
              return next;
            });
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setFocusedIndex(-1);
          // Blur the container so keyboard nav stops
          (e.target as HTMLElement).blur?.();
          break;
      }
    },
    [navigableCount, focusedIndex, filtered]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <FilterBar
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onToggleAll={toggleAll}
        countByType={countByType}
      />

      {/* Entry list */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-[10px]">
          <span className="text-[28px] opacity-20">📡</span>
          <span className="text-sm font-medium text-(--color-text-secondary)">
            {focusAgent
              ? `No activity for ${focusAgent}`
              : hasNoEntries
                ? "Waiting for agents to start…"
                : "No events match filter"}
          </span>
          <span className="text-xs text-(--color-text-tertiary)">
            {focusAgent
              ? "Events will appear when this agent is active"
              : hasNoEntries
                ? "Start a relay session to see live activity"
                : "Adjust filters above to see more events"}
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto pt-1 pb-1 relative outline-none"
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label="Activity feed entries"
          aria-activedescendant={
            focusedIndex >= 0 && focusedIndex < filtered.length
              ? `activity-entry-${filtered[focusedIndex].id}`
              : focusedIndex >= filtered.length
                ? `activity-entry-thinking-${thinkingAgents[focusedIndex - filtered.length]?.agentId}`
                : undefined
          }
        >
          {totalEventCount > entries.length && (
            <div className="text-center px-4 py-1.5 text-[10px] text-(--color-text-tertiary) font-mono border-b border-(--color-border-secondary)">
              {totalEventCount - entries.length} earlier events omitted
            </div>
          )}

          {groups.map((group, gi) => {
            const prevGroup = groups[gi - 1];
            const prevLast = prevGroup?.entries[prevGroup.entries.length - 1];
            const curFirst = group.entries[0];
            const showSeparator = prevLast && curFirst.timestamp - prevLast.timestamp > 60_000;
            const groupOffset = groupOffsets[gi];

            return (
              <Fragment key={curFirst.id}>
                {showSeparator && <TimeSeparator timestamp={curFirst.timestamp} />}
                {group.collapsed ? (
                  <CollapsedGroup
                    group={group}
                    focusedIndex={focusedIndex}
                    globalOffset={groupOffset}
                    expandedEntries={expandedEntries}
                    onClickArtifact={handleClickArtifact}
                  />
                ) : (
                  group.entries.map((entry, i) => (
                    <EntryRenderer
                      key={entry.id}
                      entry={entry}
                      isFocused={focusedIndex === groupOffset + i}
                      entryId={`activity-entry-${entry.id}`}
                      isExpanded={expandedEntries.has(entry.id)}
                      onClickArtifact={handleClickArtifact}
                    />
                  ))
                )}
              </Fragment>
            );
          })}

          {/* Live thinking cards — one per agent, at the bottom */}
          {thinkingAgents.map(({ agentId, chunk, isLive }) => (
            <ThinkingEntry
              key={`thinking-${agentId}`}
              agentId={agentId}
              chunk={chunk}
              isLive={isLive}
            />
          ))}

          <div ref={bottomRef} className="h-px" />

          {/* Scroll-to-bottom button */}
          {showScrollBtn && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="sticky bottom-[10px] block ml-auto mr-4 text-[10px] text-(--color-text-secondary) bg-(--color-surface-overlay) border border-(--color-border-default) rounded px-[10px] py-[3px] cursor-pointer font-mono"
            >
              ↓ New activity
            </button>
          )}
        </div>
      )}

      {/* Artifact detail modal */}
      {artifactModal && (
        <ArtifactDetailModal
          artifactId={artifactModal.artifactId}
          serverUrl={activeServer}
          anchorRect={artifactModal.rect}
          onClose={() => setArtifactModal(null)}
        />
      )}
    </div>
  );
}
