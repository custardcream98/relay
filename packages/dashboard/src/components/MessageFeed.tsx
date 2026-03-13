// packages/dashboard/src/components/MessageFeed.tsx
import { useEffect, useRef } from "react";
import { AGENT_ACCENT_HEX } from "../constants/agents";
import { MarkdownContent } from "./MarkdownContent";

interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  created_at: number;
}

function formatTime(unixSecs: number) {
  return new Date(unixSecs * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function MessageFeed({ messages }: { messages: Message[] }) {
  // 메시지 배열이 최신순(newest first)이므로 topRef를 목록 맨 위에 배치해 최신 메시지로 스크롤
  const topRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 빈 상태
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
          }}
        >
          No messages yet
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-disabled)",
          }}
        >
          Agent communications will appear here
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ borderTop: "none" }}>
      {/* 최신 메시지(배열 맨 앞)로 스크롤하기 위해 topRef를 목록 상단에 배치 */}
      <div ref={topRef} />
      {messages.map((msg) => {
        const fromColor = AGENT_ACCENT_HEX[msg.from_agent] ?? "#9898a8";
        const toColor = msg.to_agent ? (AGENT_ACCENT_HEX[msg.to_agent] ?? "#9898a8") : null;
        // 아바타 이니셜 (에이전트 이름 첫 글자 대문자)
        const initial = msg.from_agent.charAt(0).toUpperCase();

        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: hover 시 배경색 변경을 위한 마우스 핸들러로, 상호작용 의미 없음
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 14px",
              borderBottom: "1px solid var(--color-border-subtle)",
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-raised)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "transparent";
            }}
          >
            {/* 아바타 컬럼 — 28px */}
            <div style={{ width: 28, flexShrink: 0 }}>
              <div
                role="img"
                aria-label={msg.from_agent}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  // accent 15% opacity 배경
                  background: `${fromColor}26`,
                  // accent 25% opacity 테두리
                  border: `1px solid ${fromColor}40`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: fromColor,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {initial}
              </div>
            </div>

            {/* 콘텐츠 컬럼 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 헤더 행 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                {/* 발신 에이전트 이름 */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: fromColor,
                  }}
                >
                  {msg.from_agent}
                </span>

                {msg.to_agent ? (
                  <>
                    {/* 화살표 — to_agent 있을 때만 */}
                    <span style={{ fontSize: 11, color: "var(--color-text-disabled)" }}>→</span>
                    {/* 수신 에이전트 이름 */}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: toColor ?? "var(--color-text-secondary)",
                      }}
                    >
                      {msg.to_agent}
                    </span>
                  </>
                ) : (
                  /* broadcast 배지 — to_agent 없을 때 */
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: "var(--color-text-disabled)",
                      background: "var(--color-surface-overlay)",
                      padding: "1px 5px",
                      borderRadius: 3,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    broadcast
                  </span>
                )}

                {/* 타임스탬프 — 오른쪽 끝 */}
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-disabled)",
                    marginLeft: "auto",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatTime(msg.created_at)}
                </span>
              </div>

              {/* 메시지 본문 (마크다운 렌더링) */}
              <MarkdownContent text={msg.content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
