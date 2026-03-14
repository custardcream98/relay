// packages/dashboard/src/components/EventTimeline.tsx
// Chronological stream of all relay events

import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import type { AgentId, TimelineEntry } from "../types";
import { relativeTime } from "../utils/time";

interface Props {
  entries: TimelineEntry[];
  focusAgent: AgentId | null; // Focus Mode: filter to a specific agent
}

// Icon per event type
function eventIcon(type: TimelineEntry["type"]): string {
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
    case "team:composed":
      return "👥";
    default:
      return "·";
  }
}

// 타입 필터 설정 — 각 타입의 레이블과 아이콘
type FilterableType = TimelineEntry["type"];

interface FilterDef {
  type: FilterableType;
  label: string;
  icon: string;
}

const FILTER_DEFS: FilterDef[] = [
  { type: "message:new", label: "Messages", icon: "💬" },
  { type: "task:updated", label: "Tasks", icon: "✅" },
  { type: "artifact:posted", label: "Artifacts", icon: "📦" },
  { type: "agent:thinking", label: "Thinking", icon: "🧠" },
  { type: "agent:status", label: "Status", icon: "⚡" },
  { type: "memory:updated", label: "Memory", icon: "💾" },
  { type: "review:requested", label: "Review", icon: "🔍" },
];

// 초기값: 모든 타입 on
function buildDefaultFilters(): Set<FilterableType> {
  return new Set(FILTER_DEFS.map((f) => f.type));
}

export function EventTimeline({ entries, focusAgent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // 이벤트 타입별 필터 상태 — 컴포넌트 내부 useState로 관리
  const [activeFilters, setActiveFilters] = useState<Set<FilterableType>>(buildDefaultFilters);
  // 필터 패널 열림/닫힘
  const [filterOpen, setFilterOpen] = useState(false);

  // Refresh relative timestamps every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // focusAgent 필터 + 타입 필터를 AND 조합으로 적용
  const filtered = entries.filter((e) => {
    if (focusAgent && e.agentId !== focusAgent) return false;
    // team:composed는 필터 목록에 없으므로 항상 통과
    if (e.type === "team:composed") return true;
    return activeFilters.has(e.type);
  });

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

  const toggleFilter = useCallback((type: FilterableType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const allOn = activeFilters.size === FILTER_DEFS.length;
  const toggleAll = useCallback(() => {
    setActiveFilters(allOn ? new Set() : buildDefaultFilters());
  }, [allOn]);

  const isFiltered = activeFilters.size < FILTER_DEFS.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 필터 pill 행 */}
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
        {/* 필터 토글 버튼 */}
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

        {/* 필터 패널이 열려있을 때 pill 행 */}
        {filterOpen && (
          <>
            {/* 전체 on/off 토글 */}
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
                    transition: "background 100ms, border-color 100ms, color 100ms",
                    opacity: isActive ? 1 : 0.5,
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

      {/* 이벤트 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1" style={{ gap: 10 }}>
          <span style={{ fontSize: 28, opacity: 0.2 }}>📡</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-secondary)" }}>
            {focusAgent
              ? `No events for ${focusAgent}`
              : isFiltered
                ? "No events match filter"
                : "Waiting for events…"}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
            {isFiltered
              ? "Adjust filters above to see more events"
              : focusAgent
                ? "Events will appear when this agent is active"
                : "Start a relay session to see live events"}
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
          style={{ padding: "12px 0" }}
        >
          {filtered.map((entry, idx) => {
            const accentColor = entry.agentId ? getAgentAccent(entry.agentId) : "#4a4a55";
            const isLast = idx === filtered.length - 1;

            return (
              <EventCard key={entry.id} entry={entry} accentColor={accentColor} isLast={isLast} />
            );
          })}
          <div ref={bottomRef} style={{ height: 1 }} />
        </div>
      )}
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
