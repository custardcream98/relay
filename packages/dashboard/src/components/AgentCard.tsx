// packages/dashboard/src/components/AgentCard.tsx
// Agent card — avatar, status badge, activity preview, task count

import { memo } from "react";
import { AGENT_ACCENT_HEX, DEFAULT_AGENT_ACCENT } from "../constants/agents";
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

// Status badge colors — hex so we can append alpha suffix (e.g. ${COLOR}18)
const STATUS_BADGE_COLOR: Record<string, string> = {
  working: "#34d399",
  waiting: "#fbbf24",
  idle: "#4a4a55",
};

export const AgentCard = memo(function AgentCard({
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
  const accentColor = AGENT_ACCENT_HEX[id] ?? DEFAULT_AGENT_ACCENT;
  const isWorking = status === "working";
  const isWaiting = status === "waiting";

  // Activity preview: thinking chunk when working, otherwise last message
  const activityText =
    isWorking && thinkingChunk
      ? thinkingChunk.slice(-120) // show last 120 chars
      : lastMessage
        ? lastMessage.slice(0, 80)
        : null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: div used to preserve card styling
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
      {/* Avatar — agent emoji + color ring */}
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
            // working state: apply ring-pulse animation
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
        {/* Status dot — bottom right */}
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

      {/* Content column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row: name + status badge + task count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          {/* Agent name */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isSelected ? accentColor : "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {name}
          </span>

          {/* Status badge */}
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
            {status}
          </span>

          {/* In-progress task count — right end */}
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

        {/* Activity preview */}
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
              // accent-flash effect on thinking text while working
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
});
