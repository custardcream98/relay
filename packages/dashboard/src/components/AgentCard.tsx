// packages/dashboard/src/components/AgentCard.tsx
// Agent card — avatar, status badge, activity preview, task count

import { memo, useCallback, useMemo } from "react";
import { getAgentAccent } from "../constants/agents";
import { cn } from "../lib/cn";
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
  onSelectAgent: (id: AgentId | null) => void;
  // Unix ms timestamp when this agent joined — null if present from session start
  joinedAt: number | null;
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
  onSelectAgent,
  joinedAt,
}: Props) {
  // Stable handlers: toggle selection on click/Enter — no new function created on parent re-renders
  const onClick = useCallback(() => {
    onSelectAgent(isSelected ? null : id);
  }, [onSelectAgent, isSelected, id]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onClick();
    },
    [onClick]
  );
  const accentColor = getAgentAccent(id);
  const isWorking = status === "working";
  const isWaiting = status === "waiting";
  const isNewlyJoined = joinedAt !== null && Date.now() - joinedAt < 3000;

  // Dynamic colors from runtime hex — must stay inline
  const cardStyle = useMemo(
    () => ({
      background: isSelected ? `${accentColor}12` : "transparent",
      border: `1px solid ${isSelected ? `${accentColor}30` : "var(--color-border-subtle)"}`,
      boxShadow: isSelected ? `0 0 0 1px ${accentColor}20` : "none",
    }),
    [isSelected, accentColor]
  );

  const avatarStyle = useMemo(
    () => ({
      background: `${accentColor}15`,
      boxShadow: isWorking
        ? `0 0 0 2px ${accentColor}`
        : isWaiting
          ? `0 0 0 2px ${accentColor}60`
          : `0 0 0 1px ${accentColor}30`,
      color: accentColor,
      animation: isWorking ? "ring-pulse 1.6s ease-in-out infinite" : "none",
    }),
    [accentColor, isWorking, isWaiting]
  );

  const statusBadgeStyle = useMemo(
    () => ({
      color: STATUS_BADGE_COLOR[status],
      background: `${STATUS_BADGE_COLOR[status]}18`,
    }),
    [status]
  );

  const taskCountStyle = useMemo(
    () => ({
      color: accentColor,
      background: `${accentColor}18`,
      marginLeft: isWorking ? "auto" : 0,
    }),
    [accentColor, isWorking]
  );

  const thinkingBubbleStyle = useMemo(
    () => ({
      background: `${accentColor}10`,
      border: `1px solid ${accentColor}28`,
    }),
    [accentColor]
  );

  // Activity preview: thinking chunk when working, otherwise last message
  const activityText =
    isWorking && thinkingChunk
      ? thinkingChunk.slice(-120)
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
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex flex-row items-start gap-3 p-3 mb-1 rounded-lg cursor-pointer",
        "transition-[background,border-color,box-shadow] duration-[120ms] outline-none",
        !isSelected &&
          "hover:bg-[var(--color-surface-raised)] hover:!border-[var(--color-border-default)]",
        isNewlyJoined && "animate-[agent-join-glow_3s_ease-out_forwards]"
      )}
      style={cardStyle}
    >
      {/* Avatar — agent emoji + color ring */}
      <div className="relative shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[20px] transition-[box-shadow] duration-300"
          style={avatarStyle}
        >
          {emoji}
        </div>
        {/* Status dot — bottom right */}
        <span
          className="absolute bottom-0 right-0 w-[10px] h-[10px] rounded-full block shrink-0 border-2 border-[var(--color-surface-base)]"
          style={{ background: STATUS_BADGE_COLOR[status] }}
        />
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Header row: name + status badge + task count */}
        <div className="flex items-center gap-1.5 mb-1">
          {/* Agent name */}
          <span
            className="text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
            style={{ color: isSelected ? accentColor : "var(--color-text-primary)" }}
          >
            {name}
          </span>

          {/* Agent ID badge */}
          <span className="font-mono text-[10px] text-[var(--color-text-disabled)] bg-[var(--color-surface-overlay)] px-[5px] py-[1px] rounded-full shrink-0">
            {id}
          </span>

          {/* Status badge */}
          <span
            className="font-mono text-[10px] font-medium px-[5px] py-[1px] rounded-[3px] uppercase tracking-[0.05em] shrink-0"
            style={statusBadgeStyle}
          >
            {status}
          </span>

          {/* Last active timestamp */}
          {!isWorking && lastActivityTs && (
            <span className="font-mono text-[9px] text-[var(--color-text-disabled)] ml-auto shrink-0">
              {relativeTime(lastActivityTs)}
            </span>
          )}

          {/* In-progress task count */}
          {inProgressCount > 0 && (
            <span
              className="font-mono text-[10px] px-1.5 py-[1px] rounded-full shrink-0"
              style={taskCountStyle}
            >
              {inProgressCount} {inProgressCount === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>

        {/* Base persona subtitle — only for extends agents */}
        {basePersonaId && (
          <div
            className="text-[11px] text-[var(--color-text-disabled)] italic mb-[2px]"
            title={`Extends ${basePersonaId}`}
          >
            ↳ {basePersonaId}
          </div>
        )}

        {/* Activity preview */}
        {isWorking && thinkingChunk ? (
          // Thinking bubble — chat bubble style with blinking cursor
          <div
            className="text-xs leading-[1.55] text-[var(--color-text-secondary)] rounded-[6px] p-[4px_8px] font-mono overflow-hidden"
            style={{
              ...thinkingBubbleStyle,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {activityText}
            {/* Blinking cursor — reuses blink keyframe from index.css */}
            <span
              className="inline-block w-1.5 h-[11px] ml-[2px] align-text-bottom opacity-80"
              style={{ animation: "blink 1.1s step-end infinite", background: accentColor }}
            />
          </div>
        ) : activityText ? (
          <p
            className="text-xs leading-[1.5] text-[var(--color-text-tertiary)] m-0 overflow-hidden font-sans"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {activityText}
          </p>
        ) : (
          <p className="text-xs text-[var(--color-text-disabled)] m-0 italic">
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
