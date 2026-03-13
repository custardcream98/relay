// packages/dashboard/src/components/EventTimeline.tsx
// Chronological stream of all relay events

import { useCallback, useEffect, useRef, useState } from "react";
import { AGENT_ACCENT_HEX, DEFAULT_AGENT_ACCENT } from "../constants/agents";
import type { AgentId, RelayEvent, TimelineEntry } from "../types";
import { relativeTime } from "../utils/time";

interface Props {
  entries: TimelineEntry[];
  focusAgent: AgentId | null; // Focus Mode: filter to a specific agent
}

// Icon per event type
function eventIcon(type: RelayEvent["type"]): string {
  switch (type) {
    case "message:new":
      return "💬";
    case "task:updated":
      return "✅";
    case "artifact:posted":
      return "📦";
    case "agent:thinking":
      return "🧠";
    case "review:requested":
      return "🔍";
    case "agent:status":
      return "⚡";
    case "memory:updated":
      return "💾";
    default:
      return "·";
  }
}

export function EventTimeline({ entries, focusAgent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Refresh relative timestamps every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Focus Mode: filter entries to the selected agent
  const filtered = focusAgent ? entries.filter((e) => e.agentId === focusAgent) : entries;

  // Auto-scroll to bottom on new events, unless user has scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on entry count change
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrollingRef.current = distFromBottom > 80;
  }, []);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 10 }}>
        <span style={{ fontSize: 28, opacity: 0.2 }}>📡</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-secondary)" }}>
          {focusAgent ? `No events for ${focusAgent}` : "Waiting for events…"}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          {focusAgent
            ? "Events will appear when this agent is active"
            : "Start a relay session to see live events"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      onScroll={handleScroll}
      style={{ padding: "12px 0" }}
    >
      {filtered.map((entry, idx) => {
        const accentColor = entry.agentId
          ? (AGENT_ACCENT_HEX[entry.agentId] ?? DEFAULT_AGENT_ACCENT)
          : "#4a4a55";
        const isLast = idx === filtered.length - 1;

        return <EventCard key={entry.id} entry={entry} accentColor={accentColor} isLast={isLast} />;
      })}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}

// Single event card — click to expand/collapse full detail
interface EventCardProps {
  entry: TimelineEntry;
  accentColor: string;
  isLast: boolean;
}

function EventCard({ entry, accentColor, isLast }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const detailRef = useRef<HTMLParagraphElement>(null);
  const hasDetail = !!entry.detail;

  // Check if the detail text is actually overflowing (needs expand)
  // biome-ignore lint/correctness/useExhaustiveDependencies: check on entry change
  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    setIsTruncated(el.scrollHeight > el.clientHeight + 2);
  }, [entry.detail, expanded]);

  const canExpand = hasDetail && isTruncated;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: card expander, not a button
    // biome-ignore lint/a11y/useKeyWithClickEvents: card expander, not a button
    <div
      onClick={canExpand || expanded ? () => setExpanded((v) => !v) : undefined}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 0,
        padding: "0 16px",
        animation: "slide-in-top 200ms ease-out both",
        cursor: canExpand || expanded ? "pointer" : "default",
      }}
      className="group"
    >
      {/* Track line + event node */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 32,
          flexShrink: 0,
          marginRight: 12,
        }}
      >
        {/* Event icon node */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}30`,
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          {eventIcon(entry.type)}
        </div>

        {/* Vertical connector line (hidden on last item) */}
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 8,
              background: "var(--color-border-subtle)",
              margin: "2px 0",
            }}
          />
        )}
      </div>

      {/* Event content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: isLast ? 0 : 12,
          paddingTop: 4,
        }}
      >
        {/* Header row: agent chip + description + timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 3,
          }}
        >
          {/* Agent name chip */}
          {entry.agentId && (
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: accentColor,
                background: `${accentColor}18`,
                padding: "1px 5px",
                borderRadius: 3,
                flexShrink: 0,
              }}
            >
              {entry.agentId}
            </span>
          )}

          {/* Event description */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {entry.description}
          </span>

          {/* Timestamp */}
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {relativeTime(entry.timestamp)}
          </span>
        </div>

        {/* Detail text — collapsed (2 lines) or expanded (full) on click */}
        {entry.detail && (
          <p
            ref={detailRef}
            style={{
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--color-text-secondary)",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              ...(expanded
                ? {}
                : {
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }),
              fontFamily: entry.type === "agent:thinking" ? "var(--font-mono)" : "var(--font-sans)",
            }}
          >
            {entry.detail}
          </p>
        )}
        {/* Expand / collapse hint — only when content is actually truncated */}
        {(canExpand || expanded) && (
          <span
            style={{
              fontSize: 9,
              color: "var(--color-text-disabled)",
              marginTop: 2,
              display: "block",
              userSelect: "none",
            }}
          >
            {expanded ? "▲ collapse" : "▼ expand"}
          </span>
        )}
      </div>
    </div>
  );
}
