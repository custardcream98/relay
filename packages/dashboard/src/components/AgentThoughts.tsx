// packages/dashboard/src/components/AgentThoughts.tsx
import type { AgentId } from "@custardcream/relay-shared";
import { useEffect, useRef, useState } from "react";
import { AGENT_ACCENT_HEX } from "../constants/agents";

interface Props {
  agentId: AgentId | null;
  chunks: string;
  status?: "idle" | "working" | "waiting";
}

export function AgentThoughts({ agentId, chunks, status = "idle" }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // 유저가 위로 스크롤했는지 추적
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // chunks 변경 시 자동 스크롤 (유저가 위로 스크롤하지 않은 경우에만)
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on chunks change
  useEffect(() => {
    if (!userScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunks]);

  // 스크롤 이벤트 — 아래에서 60px 이상 위에 있으면 자동 스크롤 일시 중지
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distFromBottom > 60);
  };

  const accentColor = agentId ? (AGENT_ACCENT_HEX[agentId] ?? "#9898a8") : "#9898a8";

  // 상태 배지 텍스트
  const statusText =
    status === "working" ? "thinking..." : status === "waiting" ? "waiting" : "idle";

  // 커서 스타일: working=accent 색상 고정, idle/waiting=text-disabled 깜박임
  const cursorStyle: React.CSSProperties =
    status === "working"
      ? {
          // working 커서 — accent 색상, 깜박임 없음
          display: "inline-block",
          width: 7,
          height: 14,
          background: accentColor,
          marginLeft: 2,
          verticalAlign: "text-bottom",
        }
      : {
          // idle 커서 — text-disabled 색상, blink 애니메이션
          display: "inline-block",
          width: 7,
          height: 14,
          background: "var(--color-text-disabled)",
          marginLeft: 2,
          verticalAlign: "text-bottom",
          animation: "blink 1.2s step-end infinite",
        };

  return (
    <div className="flex flex-col h-full">
      {/* 내부 서브헤더 스트립 — 에이전트 선택 시만 표시 */}
      {agentId && (
        <div
          style={{
            height: 36,
            flexShrink: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingLeft: 14,
            paddingRight: 14,
            background: "var(--color-surface-base)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          {/* 에이전트 이름 */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: accentColor,
              fontFamily: "var(--font-sans)",
            }}
          >
            {agentId}
          </span>
          {/* 상태 배지 */}
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: "var(--color-text-disabled)",
              background: "var(--color-surface-overlay)",
              padding: "1px 6px",
              borderRadius: 3,
            }}
          >
            {statusText}
          </span>
        </div>
      )}

      {/* 에이전트 미선택 상태 */}
      {!agentId && (
        <div className="flex flex-col items-center justify-center h-full" style={{ gap: 12 }}>
          {/* 채팅 버블 SVG 아이콘 */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: "var(--color-text-disabled)", opacity: 0.4 }}
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-sans)",
            }}
          >
            No agent selected
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-disabled)",
              textAlign: "center",
              maxWidth: 200,
            }}
          >
            Select an agent from the bar above to inspect its reasoning
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: "var(--color-text-disabled)",
              marginTop: 4,
            }}
          >
            Click any agent chip ↑
          </span>
        </div>
      )}

      {/* 스트림 영역 — 에이전트 선택 시 */}
      {agentId && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="font-mono flex-1 overflow-auto"
          style={{
            background: "var(--color-surface-inset)",
            padding: "14px 16px",
            fontSize: 12,
            lineHeight: 1.7,
            color: "var(--color-text-secondary)",
            position: "relative",
          }}
        >
          {chunks}
          {/* 커서 */}
          <span style={cursorStyle} />
          <div ref={bottomRef} />

          {/* 아래로 이동 버튼 — 유저가 위로 스크롤한 경우 */}
          {userScrolledUp && (
            <button
              type="button"
              onClick={() => {
                setUserScrolledUp(false);
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{
                position: "sticky",
                bottom: 8,
                display: "block",
                marginLeft: "auto",
                fontSize: 10,
                color: "var(--color-text-secondary)",
                background: "var(--color-surface-overlay)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
                padding: "3px 8px",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              ↓ latest
            </button>
          )}
        </div>
      )}
    </div>
  );
}
