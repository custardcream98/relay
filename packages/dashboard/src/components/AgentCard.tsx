// packages/dashboard/src/components/AgentCard.tsx
// Agent card — avatar, status badge, activity preview, task count

import { memo, useMemo } from "react";
import { getAgentAccent } from "../constants/agents";
import type { AgentId } from "../types";
import { relativeTime } from "../utils/time";

interface Props {
  id: AgentId;
  name: string;
  emoji: string;
  // Set when this agent was created via `extends` in the pool YAML
  basePersonaId?: string;
  status: "idle" | "working" | "waiting" | "done";
  thinkingChunk: string;
  lastMessage: string | null;
  // Unix ms timestamp of most recent task/message activity — null if no activity yet
  lastActivityTs: number | null;
  inProgressCount: number;
  isSelected: boolean;
  onClick: () => void;
}

// Status badge colors — hex so we can append alpha suffix (e.g. ${COLOR}18)
const STATUS_BADGE_COLOR: Record<string, string> = {
  working: "#34d399",
  waiting: "#fbbf24",
  done: "#818cf8",
  idle: "#4a4a55",
};

export const AgentCard = memo(function AgentCard({
  id,
  name,
  emoji,
  basePersonaId,
  status,
  thinkingChunk,
  lastMessage,
  lastActivityTs,
  inProgressCount,
  isSelected,
  onClick,
}: Props) {
  const accentColor = getAgentAccent(id);
  const isWorking = status === "working";
  const isWaiting = status === "waiting";

  // Stable card container style — recomputed only when selection or accentColor changes
  const cardStyle = useMemo(
    () => ({
      position: "relative" as const,
      display: "flex",
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
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
    }),
    [isSelected, accentColor]
  );

  // Stable avatar circle style — recomputed only when accentColor or working state changes
  const avatarStyle = useMemo(
    () => ({
      width: 40,
      height: 40,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 20,
      background: `${accentColor}15`,
      boxShadow: isWorking
        ? `0 0 0 2px ${accentColor}`
        : isWaiting
          ? `0 0 0 2px ${accentColor}60`
          : `0 0 0 1px ${accentColor}30`,
      animation: isWorking ? "ring-pulse 1.6s ease-in-out infinite" : "none",
      color: accentColor,
      transition: "box-shadow 300ms",
    }),
    [accentColor, isWorking, isWaiting]
  );

  // Stable agent name color style
  const agentNameStyle = useMemo(
    () => ({
      fontSize: 13,
      fontWeight: 600,
      color: isSelected ? accentColor : "var(--color-text-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
      minWidth: 0,
    }),
    [isSelected, accentColor]
  );

  // Stable status badge style — recomputed only when status changes
  const statusBadgeStyle = useMemo(
    () => ({
      fontSize: 10,
      fontWeight: 500,
      color: STATUS_BADGE_COLOR[status],
      background: `${STATUS_BADGE_COLOR[status]}18`,
      padding: "1px 5px",
      borderRadius: 3,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      flexShrink: 0,
    }),
    [status]
  );

  // Stable in-progress task count style
  const taskCountStyle = useMemo(
    () => ({
      fontSize: 10,
      color: accentColor,
      background: `${accentColor}18`,
      padding: "1px 6px",
      borderRadius: 9999,
      marginLeft: isWorking ? "auto" : 0,
      flexShrink: 0,
    }),
    [accentColor, isWorking]
  );

  // Stable thinking bubble style
  const thinkingBubbleStyle = useMemo(
    () => ({
      fontSize: 12,
      lineHeight: 1.55,
      color: "var(--color-text-secondary)",
      background: `${accentColor}10`,
      border: `1px solid ${accentColor}28`,
      borderRadius: 6,
      padding: "4px 8px",
      fontFamily: "var(--font-mono)",
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical" as const,
    }),
    [accentColor]
  );

  // Stable blinking cursor style
  const cursorStyle = useMemo(
    () => ({
      display: "inline-block",
      width: 6,
      height: 11,
      background: accentColor,
      marginLeft: 2,
      verticalAlign: "text-bottom" as const,
      animation: "blink 1.1s step-end infinite",
      opacity: 0.8,
    }),
    [accentColor]
  );

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
      style={cardStyle}
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
        <div style={avatarStyle}>{emoji}</div>
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
          <span style={agentNameStyle}>{name}</span>

          {/* Agent ID badge — always visible for disambiguation */}
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: "var(--color-text-disabled)",
              background: "var(--color-surface-overlay)",
              padding: "1px 5px",
              borderRadius: 9999,
              flexShrink: 0,
            }}
          >
            {id}
          </span>

          {/* Status badge */}
          <span className="font-mono" style={statusBadgeStyle}>
            {status}
          </span>

          {/* Last active timestamp — shown when idle/done/waiting and activity exists */}
          {!isWorking && lastActivityTs && (
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: "var(--color-text-disabled)",
                marginLeft: "auto",
                flexShrink: 0,
              }}
            >
              {relativeTime(lastActivityTs)}
            </span>
          )}

          {/* In-progress task count — right end, only when working */}
          {inProgressCount > 0 && (
            <span className="font-mono" style={taskCountStyle}>
              {inProgressCount} {inProgressCount === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>

        {/* Base persona subtitle — only for extends agents */}
        {basePersonaId && (
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-disabled)",
              fontStyle: "italic",
              marginBottom: 2,
            }}
          >
            ↳ {basePersonaId}
          </div>
        )}

        {/* Activity preview */}
        {isWorking && thinkingChunk ? (
          // Thinking bubble — chat bubble style with blinking cursor
          <div style={thinkingBubbleStyle}>
            {activityText}
            {/* Blinking cursor — reuses blink keyframe from index.css */}
            <span style={cursorStyle} />
          </div>
        ) : activityText ? (
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--color-text-tertiary)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              margin: 0,
              fontFamily: "var(--font-sans)",
            }}
          >
            {activityText}
          </p>
        ) : (
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-disabled)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            {status === "waiting"
              ? "Waiting for work…"
              : status === "done"
                ? "Session complete"
                : "No activity yet"}
          </p>
        )}
      </div>
    </div>
  );
});
