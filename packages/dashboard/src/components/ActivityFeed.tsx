// packages/dashboard/src/components/ActivityFeed.tsx
// Chat-style unified activity feed — replaces EventTimeline + MessageFeed.
// Renders all relay events in chronological order (latest at bottom),
// with event-type-specific visual treatment per designer spec.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServer } from "../context/ServerContext";
import { usePopover } from "../hooks/usePopover";
import { cn } from "../lib/cn";
import type { AgentId, TimelineEntry } from "../types";
import { ArtifactDetailModal } from "./ArtifactDetailModal";
import type { FilterableType } from "./activity";
import {
  buildDefaultFilters,
  EntryRenderer,
  FILTER_DEFS,
  FILTER_STORAGE_KEY,
  ThinkingEntry,
} from "./activity";

interface Props {
  entries: TimelineEntry[];
  focusAgent: AgentId | null;
  // Live thinking chunks — keyed by agentId, shown as streaming cards
  thinkingChunks: Partial<Record<AgentId, string>>;
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting" | "done">>;
}

export function ActivityFeed({ entries, focusAgent, thinkingChunks, agentStatuses }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
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
  const [filterOpen, setFilterOpen] = useState(false);

  // Close filter panel on Escape or outside click
  usePopover(filterBarRef, () => setFilterOpen(false), { enabled: filterOpen });

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
        // agent:thinking historical entries are only shown when the filter is explicitly ON.
        // Live thinking is always rendered via thinkingChunks below (not from entries),
        // so the toggle consistently controls both historical and live display.
        return activeFilters.has(e.type);
      }),
    [entries, focusAgent, activeFilters]
  );

  // Live thinking agents — only show when working and chunk is non-empty
  const thinkingAgents = useMemo(
    () =>
      Object.entries(thinkingChunks)
        .filter(([agentId, chunk]) => {
          if (!chunk) return false;
          if (focusAgent && agentId !== focusAgent) return false;
          if (!activeFilters.has("agent:thinking")) return false;
          return true;
        })
        .map(([agentId, chunk]) => ({
          agentId,
          chunk: chunk ?? "",
          isLive: agentStatuses[agentId as AgentId] === "working",
        })),
    [thinkingChunks, focusAgent, activeFilters, agentStatuses]
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

  const isFiltered = activeFilters.size < FILTER_DEFS.length;
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
      // Skip if a filter input or button inside the filter bar is focused
      const active = document.activeElement;
      if (active && filterBarRef.current?.contains(active)) return;

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
      <div
        ref={filterBarRef}
        className="flex items-center gap-1 px-3 py-[5px] border-b border-(--color-border-subtle) bg-(--color-surface-base) shrink-0 flex-nowrap overflow-x-auto"
      >
        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          title="Toggle filter panel"
          className={cn(
            "flex items-center gap-1 px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer shrink-0 transition-[background,border-color,color] duration-100",
            isFiltered
              ? "text-(--color-accent-fe)"
              : "border border-(--color-border-subtle) bg-transparent text-(--color-text-tertiary)"
          )}
          style={
            isFiltered
              ? {
                  border: "1px solid color-mix(in srgb, var(--color-accent-fe) 31%, transparent)",
                  background: "color-mix(in srgb, var(--color-accent-fe) 8%, transparent)",
                }
              : undefined
          }
        >
          <span className="text-[11px]">⚙</span>
          Filter
          {isFiltered && (
            <span className="text-[9px] bg-(--color-accent-fe) text-white rounded-full px-1 font-semibold">
              {FILTER_DEFS.length - activeFilters.size} off
            </span>
          )}
        </button>

        {/* Filter pills — shown when open */}
        {filterOpen && (
          <>
            <button
              type="button"
              onClick={toggleAll}
              className="px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer border border-(--color-border-default) bg-transparent text-(--color-text-tertiary) shrink-0"
            >
              {allOn ? "All off" : "All on"}
            </button>

            {FILTER_DEFS.map((def) => {
              const isActive = activeFilters.has(def.type);
              const count = countByType[def.type] ?? 0;
              return (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => toggleFilter(def.type)}
                  title={`${def.label}${count > 0 ? ` (${count})` : ""}`}
                  className={cn(
                    "flex items-center gap-[3px] px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer shrink-0 transition-[background,border-color,color] duration-100",
                    isActive
                      ? "border border-(--color-border-default) bg-(--color-surface-overlay) text-(--color-text-secondary) opacity-100"
                      : "border border-(--color-border-subtle) bg-transparent text-(--color-text-disabled) opacity-50"
                  )}
                >
                  <span className="text-[11px]">{def.icon}</span>
                  {def.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "font-mono text-[9px] px-[3px] rounded-[3px]",
                        isActive
                          ? "bg-(--color-surface-raised) text-(--color-text-tertiary)"
                          : "bg-transparent text-(--color-text-disabled)"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>

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
          {entries.length >= 200 && (
            <div className="text-center px-4 py-1.5 text-[10px] text-(--color-text-disabled) font-mono">
              Showing last 200 events
            </div>
          )}

          {filtered.map((entry, idx) => (
            <EntryRenderer
              key={entry.id}
              entry={entry}
              isFocused={focusedIndex === idx}
              entryId={`activity-entry-${entry.id}`}
              isExpanded={expandedEntries.has(entry.id)}
              onClickArtifact={handleClickArtifact}
            />
          ))}

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
