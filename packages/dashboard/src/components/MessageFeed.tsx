// packages/dashboard/src/components/MessageFeed.tsx
// Slack 스타일 메시지 피드 — 브로드캐스트/다이렉트 구분, MarkdownContent 렌더링

import { memo } from "react";
import { DEFAULT_AGENT_ACCENT, getAgentAccent } from "../constants/agents";
import type { Message } from "../types";
import { formatTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  messages: Message[];
}

// end: 선언 메시지를 감지해 배지 반환
function getEndBadge(content: string): { label: string; color: string } | null {
  if (content.startsWith("end:_done") || content.startsWith("end:failed")) {
    return { label: "done", color: "#818cf8" };
  }
  if (content.startsWith("end:waiting")) {
    return { label: "waiting", color: "#fbbf24" };
  }
  return null;
}

export const MessageFeed = memo(function MessageFeed({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 10 }}>
        <span style={{ fontSize: 28, opacity: 0.2 }}>💬</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-secondary)" }}>
          No messages yet
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          Messages will appear when agents start communicating
        </span>
      </div>
    );
  }

  // 최신 메시지가 상단에 오도록 역순 정렬
  const sorted = [...messages].sort((a, b) => b.created_at - a.created_at);

  return (
    <div className="overflow-y-auto h-full" style={{ padding: "8px 0" }}>
      {sorted.map((msg) => (
        <MessageCard key={msg.id} message={msg} />
      ))}
    </div>
  );
});

function MessageCard({ message }: { message: Message }) {
  const fromColor = getAgentAccent(message.from_agent);
  const toColor = message.to_agent ? getAgentAccent(message.to_agent) : DEFAULT_AGENT_ACCENT;
  const isBroadcast = message.to_agent === null;
  const endBadge = getEndBadge(message.content ?? "");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        // 브로드캐스트 vs 다이렉트 배경 구분
        background: isBroadcast ? "transparent" : `${toColor}06`,
      }}
    >
      {/* 발신 에이전트 아바타 */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          background: `${fromColor}15`,
          border: `1px solid ${fromColor}30`,
          flexShrink: 0,
          color: fromColor,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
        }}
      >
        {message.from_agent.slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 헤더 행: 발신자 + 수신자 + 시간 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          {/* 발신자 칩 */}
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: fromColor,
              background: `${fromColor}18`,
              padding: "1px 6px",
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            {message.from_agent}
          </span>

          {/* 방향 화살표 */}
          <span style={{ fontSize: 10, color: "var(--color-text-disabled)", flexShrink: 0 }}>
            →
          </span>

          {/* 수신자 또는 broadcast 배지 */}
          {isBroadcast ? (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: "var(--color-text-tertiary)",
                background: "var(--color-surface-overlay)",
                padding: "1px 6px",
                borderRadius: 3,
                flexShrink: 0,
              }}
            >
              broadcast
            </span>
          ) : (
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: toColor,
                background: `${toColor}18`,
                padding: "1px 6px",
                borderRadius: 3,
                flexShrink: 0,
              }}
            >
              {message.to_agent}
            </span>
          )}

          {/* end: 상태 배지 */}
          {endBadge && (
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: endBadge.color,
                background: `${endBadge.color}18`,
                padding: "1px 5px",
                borderRadius: 3,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                flexShrink: 0,
              }}
            >
              {endBadge.label}
            </span>
          )}

          {/* 타임스탬프 */}
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: "var(--color-text-disabled)",
              marginLeft: "auto",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {formatTime(message.created_at)}
          </span>
        </div>

        {/* 메시지 본문 — MarkdownContent로 렌더링 */}
        <MarkdownContent text={message.content} />
      </div>
    </div>
  );
}
