// packages/dashboard/src/components/EventTimeline.tsx
// 이벤트 타임라인 — 모든 릴레이 이벤트를 시간순으로 표시

import { useEffect, useRef } from "react";
import { AGENT_ACCENT_HEX } from "../constants/agents";
import type { AgentId, RelayEvent } from "../types";

// 표시 가능한 이벤트 항목 타입
export interface TimelineEntry {
  id: string;
  type: RelayEvent["type"];
  agentId: string | null;
  description: string;
  detail?: string;
  timestamp: number; // ms
}

interface Props {
  entries: TimelineEntry[];
  focusAgent: AgentId | null; // Focus Mode: 특정 에이전트 필터링
}

// 이벤트 타입별 아이콘
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

// 상대 시간 표시 (예: "2m ago")
function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function EventTimeline({ entries, focusAgent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Focus Mode 필터링
  const filtered = focusAgent ? entries.filter((e) => e.agentId === focusAgent) : entries;

  // 새 이벤트 시 자동 스크롤 (유저가 위로 스크롤하지 않은 경우)
  // biome-ignore lint/correctness/useExhaustiveDependencies: entries 변경 시 스크롤
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrollingRef.current = distFromBottom > 80;
  };

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 10 }}>
        <span style={{ fontSize: 28, opacity: 0.2 }}>📡</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-tertiary)" }}>
          {focusAgent ? `No events for ${focusAgent}` : "Waiting for events…"}
        </span>
        <span style={{ fontSize: 11, color: "var(--color-text-disabled)" }}>
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
          ? (AGENT_ACCENT_HEX[entry.agentId] ?? "#9898a8")
          : "#4a4a55";
        const isLast = idx === filtered.length - 1;

        return <EventCard key={entry.id} entry={entry} accentColor={accentColor} isLast={isLast} />;
      })}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}

// 개별 이벤트 카드
interface EventCardProps {
  entry: TimelineEntry;
  accentColor: string;
  isLast: boolean;
}

function EventCard({ entry, accentColor, isLast }: EventCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 0,
        padding: "0 16px",
        animation: "slide-in-top 200ms ease-out both",
      }}
      className="group"
    >
      {/* 트랙 라인 + 이벤트 노드 */}
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
        {/* 이벤트 노드 아이콘 */}
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

        {/* 수직 연결 라인 (마지막 항목 제외) */}
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

      {/* 이벤트 콘텐츠 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: isLast ? 0 : 12,
          paddingTop: 4,
        }}
      >
        {/* 헤더 행: 에이전트 이름 + 타입 + 타임스탬프 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 3,
          }}
        >
          {/* 에이전트 이름 칩 */}
          {entry.agentId && (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
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

          {/* 이벤트 설명 */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 450,
              color: "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {entry.description}
          </span>

          {/* 타임스탬프 */}
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: "var(--color-text-disabled)",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {relativeTime(entry.timestamp)}
          </span>
        </div>

        {/* 상세 텍스트 (있을 경우) */}
        {entry.detail && (
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: "var(--color-text-tertiary)",
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              fontFamily: entry.type === "agent:thinking" ? "var(--font-mono)" : "var(--font-sans)",
            }}
          >
            {entry.detail}
          </p>
        )}
      </div>
    </div>
  );
}
