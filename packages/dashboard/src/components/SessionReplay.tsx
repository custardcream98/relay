// packages/dashboard/src/components/SessionReplay.tsx
// 세션 리플레이 UI — 세션 선택 드롭다운 + 이벤트 재생 컨트롤

import type { RelayEvent } from "@custardcream/relay-shared";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { TimelineEntry } from "../types";

interface SessionRow {
  id: string;
  created_at: number; // unix seconds
  event_count: number;
}

interface Props {
  // 리플레이 모드로 진입 — 이벤트 목록과 함께 콜백
  onStartReplay: (entries: TimelineEntry[]) => void;
  // 라이브 모드로 복귀
  onExitReplay: () => void;
  isReplaying: boolean;
}

// RelayEvent → TimelineEntry 변환 (App.tsx의 eventToTimelineEntry와 동일 로직)
function eventToEntry(event: RelayEvent, id: string): TimelineEntry | null {
  const ts = event.timestamp;
  switch (event.type) {
    case "message:new":
      return {
        id,
        type: event.type,
        agentId: event.message.from_agent,
        description: event.message.to_agent ? `→ ${event.message.to_agent}` : "Broadcast message",
        detail: event.message.content,
        timestamp: ts,
      };
    case "task:updated":
      return {
        id,
        type: event.type,
        agentId: event.task.assignee,
        description: `Task ${event.task.status.replaceAll("_", " ")}: ${event.task.title}`,
        timestamp: ts,
      };
    case "artifact:posted":
      return {
        id,
        type: event.type,
        agentId: event.artifact.created_by,
        description: `Artifact: ${event.artifact.name}`,
        timestamp: ts,
      };
    case "agent:thinking":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: "Thinking…",
        detail: event.chunk,
        timestamp: ts,
      };
    case "review:requested":
      return {
        id,
        type: event.type,
        agentId: event.review.requester,
        description: `Review requested from ${event.review.reviewer}`,
        timestamp: ts,
      };
    case "agent:status":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: `Status → ${event.status}`,
        timestamp: ts,
      };
    case "memory:updated":
      return {
        id,
        type: event.type,
        agentId: event.agentId,
        description: "Memory updated",
        timestamp: ts,
      };
    default:
      return null;
  }
}

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const SessionReplay = memo(function SessionReplay({
  onStartReplay,
  onExitReplay,
  isReplaying,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 열릴 때 세션 목록 fetch
  const fetchSessions = useCallback(() => {
    setLoading(true);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: SessionRow[]) => {
        setSessions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = useCallback(() => {
    if (!open) fetchSessions();
    setOpen((v) => !v);
  }, [open, fetchSessions]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // 세션 선택 → 이벤트 fetch → replay 시작
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setSelectedId(sessionId);
      setOpen(false);
      fetch(`/api/sessions/${encodeURIComponent(sessionId)}/events`)
        .then((r) => r.json())
        .then((data: { success: boolean; events: RelayEvent[] }) => {
          const entries = data.events
            .map((ev, i) => eventToEntry(ev, `replay-${i}-${ev.type}`))
            .filter((e): e is TimelineEntry => e !== null);
          onStartReplay(entries);
        })
        .catch(() => {
          // 에러 시 무시
        });
    },
    [onStartReplay]
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      {/* 라이브 모드 복귀 버튼 (리플레이 중일 때) */}
      {isReplaying && (
        <button
          type="button"
          onClick={onExitReplay}
          style={{
            marginRight: 6,
            padding: "2px 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid #60a5fa",
            background: "#60a5fa18",
            color: "#60a5fa",
          }}
        >
          ▶ Live
        </button>
      )}

      {/* Sessions 드롭다운 버튼 */}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 10px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          border: isReplaying ? "1px solid #fbbf24" : "1px solid var(--color-border-default)",
          background: isReplaying ? "#fbbf2415" : "transparent",
          color: isReplaying ? "#fbbf24" : "var(--color-text-tertiary)",
          transition: "background 100ms, border-color 100ms, color 100ms",
        }}
      >
        <span style={{ fontSize: 12 }}>⏮</span>
        {isReplaying && selectedId ? `Replaying: ${selectedId.slice(0, 16)}…` : "Sessions"}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 260,
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 8,
            boxShadow: "var(--shadow-dropdown, 0 8px 24px rgba(0,0,0,0.35))",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--color-text-disabled)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            Recent Sessions
          </div>

          {loading && (
            <div
              style={{
                padding: "16px 12px",
                fontSize: 12,
                color: "var(--color-text-tertiary)",
                textAlign: "center",
              }}
            >
              Loading…
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div
              style={{
                padding: "16px 12px",
                fontSize: 12,
                color: "var(--color-text-tertiary)",
                textAlign: "center",
              }}
            >
              No sessions found
            </div>
          )}

          {!loading &&
            sessions.map((session) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: session item is a button-like row
              // biome-ignore lint/a11y/useKeyWithClickEvents: session item is a button-like row
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  background:
                    selectedId === session.id ? "var(--color-surface-overlay)" : "transparent",
                  transition: "background 80ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "var(--color-surface-overlay)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    selectedId === session.id ? "var(--color-surface-overlay)" : "transparent";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {session.id}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {formatDate(session.created_at)}
                  </div>
                </div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-disabled)",
                    background: "var(--color-surface-overlay)",
                    padding: "1px 6px",
                    borderRadius: 3,
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {session.event_count} events
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
});
