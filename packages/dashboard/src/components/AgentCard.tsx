// packages/dashboard/src/components/AgentCard.tsx
// 에이전트 카드 — 아바타, 상태 배지, 활동 미리보기, 태스크 수 포함

import { AGENT_ACCENT_HEX } from "../constants/agents";
import type { AgentId } from "../types";

interface Props {
  id: AgentId;
  name: string;
  emoji: string;
  status: "idle" | "working" | "waiting";
  thinkingChunk: string;
  lastMessage: string | null;
  inProgressCount: number;
  isSelected: boolean;
  onClick: () => void;
}

// 상태 레이블 텍스트
const STATUS_LABEL: Record<string, string> = {
  working: "working",
  waiting: "waiting",
  idle: "idle",
};

// 상태 배지 색상
const STATUS_BADGE_COLOR: Record<string, string> = {
  working: "var(--color-status-working)",
  waiting: "var(--color-status-waiting)",
  idle: "var(--color-text-disabled)",
};

export function AgentCard({
  id,
  name,
  emoji,
  status,
  thinkingChunk,
  lastMessage,
  inProgressCount,
  isSelected,
  onClick,
}: Props) {
  const accentColor = AGENT_ACCENT_HEX[id] ?? "#9898a8";
  const isWorking = status === "working";
  const isWaiting = status === "waiting";

  // 활동 미리보기: working 시 thinking chunk, 아니면 마지막 메시지
  const activityText =
    isWorking && thinkingChunk
      ? thinkingChunk.slice(-120) // 최근 120자만 표시
      : lastMessage
        ? lastMessage.slice(0, 80)
        : null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: 카드 스타일 유지를 위해 div 사용
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 12px",
        marginBottom: 4,
        borderRadius: 8,
        cursor: "pointer",
        transition: "background 120ms, border-color 120ms, box-shadow 120ms",
        background: isSelected ? `${accentColor}12` : "transparent",
        border: `1px solid ${isSelected ? `${accentColor}30` : "var(--color-border-subtle)"}`,
        boxShadow: isSelected ? `0 0 0 1px ${accentColor}20` : "none",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-raised)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-default)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-subtle)";
        }
      }}
    >
      {/* 아바타 — 에이전트 이모지 + 컬러 링 */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            background: `${accentColor}15`,
            // working 상태: ring-pulse 애니메이션 적용
            boxShadow: isWorking
              ? `0 0 0 2px ${accentColor}`
              : isWaiting
                ? `0 0 0 2px ${accentColor}60`
                : `0 0 0 1px ${accentColor}30`,
            animation: isWorking ? "ring-pulse 1.6s ease-in-out infinite" : "none",
            color: accentColor,
            transition: "box-shadow 300ms",
          }}
        >
          {emoji}
        </div>
        {/* 상태 도트 — 오른쪽 하단 */}
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: STATUS_BADGE_COLOR[status],
            border: "2px solid var(--color-surface-base)",
            display: "block",
            flexShrink: 0,
          }}
        />
      </div>

      {/* 콘텐츠 컬럼 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 헤더 행: 이름 + 상태 배지 + 태스크 수 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          {/* 에이전트 이름 */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isSelected ? accentColor : "var(--color-text-primary)",
              flexShrink: 0,
            }}
          >
            {name}
          </span>

          {/* 상태 배지 */}
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: STATUS_BADGE_COLOR[status],
              background: `${STATUS_BADGE_COLOR[status]}18`,
              padding: "1px 5px",
              borderRadius: 3,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            {STATUS_LABEL[status]}
          </span>

          {/* 진행 중 태스크 수 — 오른쪽 끝 */}
          {inProgressCount > 0 && (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: accentColor,
                background: `${accentColor}18`,
                padding: "1px 6px",
                borderRadius: 9999,
                marginLeft: "auto",
                flexShrink: 0,
              }}
            >
              {inProgressCount} {inProgressCount === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>

        {/* 활동 미리보기 */}
        {activityText ? (
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: isWorking ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              margin: 0,
              fontFamily: isWorking ? "var(--font-mono)" : "var(--font-sans)",
              // working 중 thinking 텍스트에 accent flash 효과
              animation:
                isWorking && thinkingChunk ? "accent-flash 2s ease-in-out infinite" : "none",
            }}
          >
            {activityText}
          </p>
        ) : (
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-disabled)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            No activity yet
          </p>
        )}
      </div>
    </div>
  );
}
