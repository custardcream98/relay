// packages/dashboard/src/components/ActivityFeed.tsx
// Chat-style unified activity feed — replaces EventTimeline + MessageFeed.
// Renders all relay events in chronological order (latest at bottom),
// with event-type-specific visual treatment per designer spec.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import { cn } from "../lib/cn";
import type { AgentId, TimelineEntry } from "../types";
import { relativeTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";
import { AgentAvatar } from "./shared/AgentAvatar";
import { AgentChip } from "./shared/AgentChip";

interface Props {
  entries: TimelineEntry[];
  focusAgent: AgentId | null;
  // Live thinking chunks — keyed by agentId, shown as streaming cards
  thinkingChunks: Partial<Record<AgentId, string>>;
  agentStatuses: Partial<Record<AgentId, "idle" | "working" | "waiting" | "done">>;
}

// Filterable event types — agent:status excluded by default (noise)
type FilterableType = TimelineEntry["type"];

interface FilterDef {
  type: FilterableType;
  label: string;
  icon: string;
  defaultOn: boolean;
}

const FILTER_DEFS: FilterDef[] = [
  { type: "message:new", label: "Messages", icon: "💬", defaultOn: true },
  { type: "task:updated", label: "Tasks", icon: "✅", defaultOn: true },
  { type: "artifact:posted", label: "Artifacts", icon: "📦", defaultOn: true },
  { type: "agent:thinking", label: "Thinking", icon: "🧠", defaultOn: true },
  { type: "review:requested", label: "Review req.", icon: "🔍", defaultOn: true },
  { type: "review:updated", label: "Review result", icon: "✔", defaultOn: true },
  { type: "agent:status", label: "Status", icon: "⚡", defaultOn: false },
  { type: "agent:joined", label: "Joined", icon: "👋", defaultOn: false },
  { type: "memory:updated", label: "Memory", icon: "💾", defaultOn: false },
];

const FILTER_STORAGE_KEY = "relay-activity-filters";

const VALID_FILTER_TYPES = new Set<string>(FILTER_DEFS.map((f) => f.type));

function buildDefaultFilters(): Set<FilterableType> {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Validate each element against known filter types to prevent stale/corrupted values
        const valid = parsed.filter(
          (item): item is FilterableType => typeof item === "string" && VALID_FILTER_TYPES.has(item)
        );
        if (valid.length > 0) return new Set(valid);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return new Set(FILTER_DEFS.filter((f) => f.defaultOn).map((f) => f.type));
}

// Detect end: declaration type from message content
function getEndDeclarationType(content: string): "done" | "waiting" | "failed" | null {
  if (content.startsWith("end:_done")) return "done";
  if (content.startsWith("end:failed")) return "failed";
  if (content.startsWith("end:waiting")) return "waiting";
  return null;
}

// Shared row layout for message/artifact/review cards
const ROW_BASE = "flex gap-[10px] px-4 py-[10px] border-b border-[var(--color-border-subtle)]";
const SLIDE_IN = "animate-[slide-in-bottom_180ms_ease-out_both]";

// [A] Broadcast message card
const MessageBroadcastEntry = memo(function MessageBroadcastEntry({
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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <AgentChip agentId={entry.agentId} />
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] bg-[var(--color-surface-overlay)] px-[5px] py-[1px] rounded-[3px]">
            broadcast
          </span>
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <MarkdownContent text={entry.detail} />
      </div>
    </div>
  );
});

// [B] Direct message card — left accent bar, tinted background
const MessageDirectEntry = memo(function MessageDirectEntry({
  entry,
  toAgent,
}: {
  entry: TimelineEntry;
  toAgent: string;
}) {
  const toColor = getAgentAccent(toAgent);

  // Dynamic border/background from runtime hex — must stay inline
  const containerStyle = useMemo(
    () => ({
      background: `${toColor}06`,
      borderLeft: `2px solid ${toColor}`,
    }),
    [toColor]
  );

  if (!entry.agentId || !entry.detail) return null;

  return (
    <div className={cn(ROW_BASE, SLIDE_IN)} style={containerStyle}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[10px] text-[var(--color-text-disabled)]">→</span>
          <AgentChip agentId={toAgent} />
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <MarkdownContent text={entry.detail} />
      </div>
    </div>
  );
});

// [C] Agent thinking card — dashed border, streaming text, blinking cursor
const ThinkingEntry = memo(function ThinkingEntry({
  agentId,
  chunk,
  isLive,
}: {
  agentId: string;
  chunk: string;
  isLive: boolean;
}) {
  const accentColor = getAgentAccent(agentId);

  const containerStyle = useMemo(
    () => ({ borderLeft: `2px dashed ${accentColor}40` }),
    [accentColor]
  );

  const thinkingLabelStyle = useMemo(
    () => ({ fontSize: 10, color: accentColor, opacity: 0.8 }),
    [accentColor]
  );

  return (
    <div
      className={cn(
        "flex gap-[10px] px-4 py-[10px]",
        "bg-[var(--color-thinking-bg)] border border-dashed border-[var(--color-thinking-border)]",
        "mx-3 my-1 rounded-[6px]",
        SLIDE_IN
      )}
      style={containerStyle}
    >
      <AgentAvatar agentId={agentId} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <AgentChip agentId={agentId} />
          <span style={thinkingLabelStyle} className="italic">
            thinking…
          </span>
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
            {isLive ? "live" : ""}
          </span>
        </div>
        <p className="text-[11px] leading-[1.6] text-[var(--color-text-secondary)] m-0 font-mono whitespace-pre-wrap break-words">
          {chunk}
          {isLive && (
            <span
              className="inline-block w-[5px] h-[11px] ml-[2px] align-text-bottom"
              style={{ background: accentColor, animation: "blink 1.2s step-end infinite" }}
            />
          )}
        </p>
      </div>
    </div>
  );
});

// [D] Task status change — inline pill, minimal visual weight
const TaskInlineEntry = memo(function TaskInlineEntry({ entry }: { entry: TimelineEntry }) {
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
      <span className="text-[11px] text-[var(--color-text-tertiary)] flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {entry.description}
      </span>
      <span className="font-mono text-[10px] text-[var(--color-text-disabled)] shrink-0">
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  );
});

// [E] Artifact posted card
const ArtifactEntry = memo(function ArtifactEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-[var(--color-text-tertiary)]">posted artifact</span>
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 px-[10px] py-1.5 bg-[var(--color-surface-raised)] border border-[var(--color-border-default)] rounded-[5px] max-w-full">
          <span className="text-sm">📄</span>
          <span className="font-mono text-[11px] text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">
            {entry.description.replace(/^Artifact: /, "")}
          </span>
        </div>
      </div>
    </div>
  );
});

// [F] Review requested card — amber action card
const ReviewEntry = memo(function ReviewEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-[var(--color-text-tertiary)]">requested review</span>
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="px-[10px] py-[7px] bg-[var(--color-review-bg)] border border-[var(--color-review-border)] rounded-[5px] text-xs text-[var(--color-end-waiting)]">
          <span className="mr-1.5">⚠</span>
          {entry.description}
        </div>
      </div>
    </div>
  );
});

// [F2] Review updated card — outcome of a review (approved/rejected/changes_requested)
const ReviewUpdatedEntry = memo(function ReviewUpdatedEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  return (
    <div className={cn(ROW_BASE, SLIDE_IN)}>
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AgentChip agentId={entry.agentId} />
          <span className="text-[11px] text-[var(--color-text-tertiary)]">submitted review</span>
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="px-[10px] py-[7px] bg-[var(--color-surface-raised)] border border-[var(--color-border-default)] rounded-[5px] text-xs text-[var(--color-text-secondary)]">
          {entry.description}
          {entry.detail && (
            <p className="text-[11px] mt-1 mb-0 text-[var(--color-text-tertiary)] whitespace-pre-wrap break-words">
              {entry.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

// [G] End declaration — compact card with avatar for clear agent attribution
const EndDeclarationEntry = memo(function EndDeclarationEntry({
  agentId,
  endType,
  timestamp,
}: {
  agentId: string;
  endType: "done" | "waiting" | "failed";
  timestamp: number;
}) {
  const colorMap = {
    done: "var(--color-end-done)",
    waiting: "var(--color-end-waiting)",
    failed: "var(--color-end-failed)",
  };
  const iconMap = { done: "✓", waiting: "⏸", failed: "✗" };
  const color = colorMap[endType];
  const agentColor = getAgentAccent(agentId);

  const containerStyle = useMemo(
    () => ({
      borderLeft: `2px solid ${agentColor}50`,
      background: `${agentColor}08`,
    }),
    [agentColor]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 border-b border-[var(--color-border-subtle)]",
        SLIDE_IN
      )}
      style={containerStyle}
    >
      <AgentAvatar agentId={agentId} size={22} />
      <AgentChip agentId={agentId} />
      <span className="text-[11px] font-semibold" style={{ color }}>
        {iconMap[endType]}
      </span>
      <span className="text-[11px] text-[var(--color-text-tertiary)]">
        {endType === "waiting"
          ? "waiting for team"
          : endType === "done"
            ? "work complete"
            : "work failed"}
      </span>
      <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
        {relativeTime(timestamp)}
      </span>
    </div>
  );
});

// System / status / memory events — tiny inline annotation
const SystemEntry = memo(function SystemEntry({ entry }: { entry: TimelineEntry }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5 px-5 py-[3px]", SLIDE_IN)}>
      <span className="text-[10px] text-[var(--color-text-disabled)]">
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
      <span className="font-mono text-[9px] text-[var(--color-text-disabled)]">
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  );
});

// Route an entry to the correct renderer
function EntryRenderer({ entry }: { entry: TimelineEntry }) {
  switch (entry.type) {
    case "message:new": {
      const isBroadcast =
        entry.description === "Broadcast message" || !entry.description.startsWith("→");
      if (isBroadcast) return <MessageBroadcastEntry entry={entry} />;
      const toAgent = entry.description.slice(2).trim();
      return <MessageDirectEntry entry={entry} toAgent={toAgent} />;
    }
    case "task:updated":
      return <TaskInlineEntry entry={entry} />;
    case "artifact:posted":
      return <ArtifactEntry entry={entry} />;
    case "review:requested":
      return <ReviewEntry entry={entry} />;
    case "review:updated":
      return <ReviewUpdatedEntry entry={entry} />;
    case "agent:status":
    case "memory:updated":
    case "agent:joined":
      return <SystemEntry entry={entry} />;
    case "agent:thinking":
      // Thinking entries in the timeline are stale (replaced by thinkingChunks in real-time)
      // Render as a system entry to preserve history
      return <SystemEntry entry={entry} />;
    default:
      return null;
  }
}

export function ActivityFeed({ entries, focusAgent, thinkingChunks, agentStatuses }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Filter state — persisted to localStorage
  const [activeFilters, setActiveFilters] = useState<Set<FilterableType>>(buildDefaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  // Close filter panel on Escape or outside click — mirrors ServerSwitcher / SessionSelector pattern
  useEffect(() => {
    if (!filterOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFilterOpen(false);
    }
    function handleClick(e: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [filterOpen]);

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div
        ref={filterBarRef}
        className="flex items-center gap-1 px-3 py-[5px] border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] shrink-0 flex-nowrap overflow-x-auto"
      >
        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          title="Toggle filter panel"
          className={cn(
            "flex items-center gap-1 px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer shrink-0 transition-[background,border-color,color] duration-100",
            isFiltered
              ? "text-[var(--color-accent-fe)]"
              : "border border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-tertiary)]"
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
            <span className="text-[9px] bg-[var(--color-accent-fe)] text-white rounded-full px-1 font-semibold">
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
              className="px-[7px] py-[2px] rounded text-[10px] font-medium cursor-pointer border border-[var(--color-border-default)] bg-transparent text-[var(--color-text-tertiary)] shrink-0"
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
                      ? "border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] opacity-100"
                      : "border border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-disabled)] opacity-50"
                  )}
                >
                  <span className="text-[11px]">{def.icon}</span>
                  {def.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "font-mono text-[9px] px-[3px] rounded-[3px]",
                        isActive
                          ? "bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)]"
                          : "bg-transparent text-[var(--color-text-disabled)]"
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
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            {focusAgent
              ? `No activity for ${focusAgent}`
              : hasNoEntries
                ? "Waiting for agents to start…"
                : "No events match filter"}
          </span>
          <span className="text-xs text-[var(--color-text-tertiary)]">
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
          className="flex-1 overflow-y-auto pt-1 pb-1 relative"
          onScroll={handleScroll}
        >
          {entries.length >= 200 && (
            <div className="text-center px-4 py-1.5 text-[10px] text-[var(--color-text-disabled)] font-mono">
              Showing last 200 events
            </div>
          )}

          {filtered.map((entry) => (
            <EntryRenderer key={entry.id} entry={entry} />
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
              className="sticky bottom-[10px] block ml-auto mr-4 text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-surface-overlay)] border border-[var(--color-border-default)] rounded px-[10px] py-[3px] cursor-pointer font-mono"
            >
              ↓ New activity
            </button>
          )}
        </div>
      )}
    </div>
  );
}
