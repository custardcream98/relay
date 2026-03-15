// packages/dashboard/src/components/ActivityFeed.tsx
// Chat-style unified activity feed — replaces EventTimeline + MessageFeed.
// Renders all relay events in chronological order (latest at bottom),
// with event-type-specific visual treatment per designer spec.

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import type { AgentId, TimelineEntry } from "../types";
import { relativeTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";

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
  { type: "memory:updated", label: "Memory", icon: "💾", defaultOn: false },
];

const FILTER_STORAGE_KEY = "relay-activity-filters";

function buildDefaultFilters(): Set<FilterableType> {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed as FilterableType[]);
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

// Agent avatar chip — circular, accent color background
function AgentAvatar({ agentId, size = 28 }: { agentId: string; size?: number }) {
  const color = getAgentAccent(agentId);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
        letterSpacing: "-0.02em",
      }}
    >
      {agentId.slice(0, 2).toUpperCase()}
    </div>
  );
}

// Agent name chip — colored mono text
function AgentChip({ agentId }: { agentId: string }) {
  const color = getAgentAccent(agentId);
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}18`,
        padding: "1px 5px",
        borderRadius: 3,
        flexShrink: 0,
      }}
    >
      {agentId}
    </span>
  );
}

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
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <AgentChip agentId={entry.agentId} />
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: "var(--color-text-disabled)",
              background: "var(--color-surface-overlay)",
              padding: "1px 5px",
              borderRadius: 3,
            }}
          >
            broadcast
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
          >
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
  if (!entry.agentId || !entry.detail) return null;

  const toColor = getAgentAccent(toAgent);

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        background: `${toColor}06`,
        borderLeft: `2px solid ${toColor}`,
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <AgentChip agentId={entry.agentId} />
          <span style={{ fontSize: 10, color: "var(--color-text-disabled)" }}>→</span>
          <AgentChip agentId={toAgent} />
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
          >
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
  const displayChunk = chunk || "";

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        background: "var(--color-thinking-bg)",
        border: "1px dashed var(--color-thinking-border)",
        borderLeft: `2px dashed ${accentColor}40`,
        margin: "4px 12px",
        borderRadius: 6,
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <AgentAvatar agentId={agentId} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <AgentChip agentId={agentId} />
          <span
            style={{
              fontSize: 10,
              color: accentColor,
              opacity: 0.8,
              fontStyle: "italic",
            }}
          >
            thinking…
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
          >
            {isLive ? "live" : ""}
          </span>
        </div>
        <p
          style={{
            fontSize: 11,
            lineHeight: 1.6,
            color: "var(--color-text-secondary)",
            margin: 0,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {displayChunk}
          {isLive && (
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 11,
                background: accentColor,
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "blink 1.2s step-end infinite",
              }}
            />
          )}
        </p>
      </div>
    </div>
  );
});

// [D] Task status change — inline pill, minimal visual weight
function TaskInlineEntry({ entry }: { entry: TimelineEntry }) {
  const accentColor = entry.agentId ? getAgentAccent(entry.agentId) : "var(--color-text-disabled)";

  // Determine icon by status keyword in description
  let icon = "📋";
  const desc = entry.description.toLowerCase();
  if (desc.includes("done")) icon = "✅";
  else if (desc.includes("in progress") || desc.includes("claimed")) icon = "🔄";
  else if (desc.includes("in review")) icon = "👁";
  else if (desc.includes("todo")) icon = "⬜";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 20px",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      {entry.agentId && (
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 600, color: accentColor }}>
          {entry.agentId}
        </span>
      )}
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-tertiary)",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.description}
      </span>
      <span
        className="font-mono"
        style={{ fontSize: 10, color: "var(--color-text-disabled)", flexShrink: 0 }}
      >
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  );
}

// [E] Artifact posted card
function ArtifactEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <AgentChip agentId={entry.agentId} />
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>posted artifact</span>
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
          >
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        {/* Artifact file card */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 5,
            maxWidth: "100%",
          }}
        >
          <span style={{ fontSize: 14 }}>📄</span>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              color: "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.description.replace(/^Artifact: /, "")}
          </span>
        </div>
      </div>
    </div>
  );
}

// [F] Review requested card — amber action card
function ReviewEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <AgentChip agentId={entry.agentId} />
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            requested review
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
          >
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div
          style={{
            padding: "7px 10px",
            background: "var(--color-review-bg)",
            border: "1px solid var(--color-review-border)",
            borderRadius: 5,
            fontSize: 12,
            color: "#fbbf24",
          }}
        >
          <span style={{ marginRight: 6 }}>⚠</span>
          {entry.description}
        </div>
      </div>
    </div>
  );
}

// [F2] Review updated card — outcome of a review (approved/rejected/changes_requested)
function ReviewUpdatedEntry({ entry }: { entry: TimelineEntry }) {
  if (!entry.agentId) return null;
  const statusText = entry.description; // e.g. "Review approved: reviewer-id"
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <AgentAvatar agentId={entry.agentId} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <AgentChip agentId={entry.agentId} />
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            submitted review
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
          >
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        <div
          style={{
            padding: "7px 10px",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 5,
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          {statusText}
          {entry.detail && (
            <p
              style={{
                fontSize: 11,
                marginTop: 4,
                marginBottom: 0,
                color: "var(--color-text-tertiary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {entry.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// [G] End declaration — inline pill (waiting / done / failed)
function EndDeclarationEntry({
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 20px",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <span style={{ fontSize: 11, color }}>{iconMap[endType]}</span>
      <span
        className="font-mono"
        style={{ fontSize: 10, fontWeight: 600, color: getAgentAccent(agentId) }}
      >
        {agentId}
      </span>
      <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
        {endType === "waiting"
          ? "waiting for team"
          : endType === "done"
            ? "work complete"
            : "work failed"}
      </span>
      <span
        className="font-mono"
        style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
      >
        {relativeTime(timestamp)}
      </span>
    </div>
  );
}

// System / status / memory events — tiny inline annotation
function SystemEntry({ entry }: { entry: TimelineEntry }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "3px 20px",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <span style={{ fontSize: 10, color: "var(--color-text-disabled)" }}>
        {entry.agentId && (
          <span
            className="font-mono"
            style={{ fontWeight: 600, color: getAgentAccent(entry.agentId) }}
          >
            {entry.agentId}{" "}
          </span>
        )}
        {entry.description}
      </span>
      <span className="font-mono" style={{ fontSize: 9, color: "var(--color-text-disabled)" }}>
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  );
}

// Team composed — session start banner
function TeamComposedEntry({ entry }: { entry: TimelineEntry }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 20px",
        borderBottom: "1px solid var(--color-border-subtle)",
        animation: "slide-in-bottom 180ms ease-out both",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--color-accent)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        ◆ {entry.description}
      </span>
    </div>
  );
}

// Route an entry to the correct renderer
function EntryRenderer({ entry }: { entry: TimelineEntry }) {
  switch (entry.type) {
    case "message:new": {
      // Parse to_agent from description — "→ agentId" or "Broadcast message"
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
    case "team:composed":
      return <TeamComposedEntry entry={entry} />;
    case "agent:status":
    case "memory:updated":
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
  const isUserScrollingRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Filter state — persisted to localStorage
  const [activeFilters, setActiveFilters] = useState<Set<FilterableType>>(buildDefaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);

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
  const filtered = entries.filter((e) => {
    if (focusAgent && e.agentId !== focusAgent) return false;
    if (e.type === "team:composed") return true;
    if (e.type === "agent:thinking") return false; // shown via thinkingChunks instead
    return activeFilters.has(e.type);
  });

  // Live thinking agents — only show when working and chunk is non-empty
  const thinkingAgents = Object.entries(thinkingChunks)
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
    }));

  // Auto-scroll to bottom on new entries, unless user has scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on entry count / thinking change
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      // Show scroll button if we have new content and user is scrolled up
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
  const isEmpty = filtered.length === 0 && thinkingAgents.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 12px",
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          flexShrink: 0,
          flexWrap: "nowrap",
          overflowX: "auto",
        }}
      >
        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          title="Toggle filter panel"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 7px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 500,
            cursor: "pointer",
            border: `1px solid ${isFiltered ? "#60a5fa50" : "var(--color-border-subtle)"}`,
            background: isFiltered ? "#60a5fa15" : "transparent",
            color: isFiltered ? "#60a5fa" : "var(--color-text-tertiary)",
            flexShrink: 0,
            transition: "background 100ms, border-color 100ms, color 100ms",
          }}
        >
          <span style={{ fontSize: 11 }}>⚙</span>
          Filter
          {isFiltered && (
            <span
              style={{
                fontSize: 9,
                background: "#60a5fa",
                color: "#fff",
                borderRadius: 9999,
                padding: "0 4px",
                fontWeight: 600,
              }}
            >
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
              style={{
                padding: "2px 7px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid var(--color-border-default)",
                background: "transparent",
                color: "var(--color-text-tertiary)",
                flexShrink: 0,
              }}
            >
              {allOn ? "All off" : "All on"}
            </button>

            {FILTER_DEFS.map((def) => {
              const isActive = activeFilters.has(def.type);
              return (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => toggleFilter(def.type)}
                  title={def.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 7px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: `1px solid ${isActive ? "var(--color-border-default)" : "var(--color-border-subtle)"}`,
                    background: isActive ? "var(--color-surface-overlay)" : "transparent",
                    color: isActive ? "var(--color-text-secondary)" : "var(--color-text-disabled)",
                    flexShrink: 0,
                    opacity: isActive ? 1 : 0.5,
                    transition: "background 100ms, border-color 100ms, color 100ms",
                  }}
                >
                  <span style={{ fontSize: 11 }}>{def.icon}</span>
                  {def.label}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Entry list */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1" style={{ gap: 10 }}>
          <span style={{ fontSize: 28, opacity: 0.2 }}>📡</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-secondary)" }}>
            {focusAgent
              ? `No activity for ${focusAgent}`
              : isFiltered
                ? "No events match filter"
                : "Waiting for agents to start…"}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
            {isFiltered
              ? "Adjust filters above to see more events"
              : focusAgent
                ? "Events will appear when this agent is active"
                : "Start a relay session to see live activity"}
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
          style={{ paddingTop: 4, paddingBottom: 4, position: "relative" }}
        >
          {filtered.length >= 200 && (
            <div
              style={{
                textAlign: "center",
                padding: "6px 16px",
                fontSize: 10,
                color: "var(--color-text-disabled)",
                fontFamily: "var(--font-mono)",
              }}
            >
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

          <div ref={bottomRef} style={{ height: 1 }} />

          {/* Scroll-to-bottom button */}
          {showScrollBtn && (
            <button
              type="button"
              onClick={scrollToBottom}
              style={{
                position: "sticky",
                bottom: 10,
                display: "block",
                marginLeft: "auto",
                marginRight: 16,
                fontSize: 10,
                color: "var(--color-text-secondary)",
                background: "var(--color-surface-overlay)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
                padding: "3px 10px",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              ↓ New activity
            </button>
          )}
        </div>
      )}
    </div>
  );
}
