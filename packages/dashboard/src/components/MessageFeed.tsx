// packages/dashboard/src/components/MessageFeed.tsx
// Chat-style message feed — chronological order, bubble layout, auto-scroll

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_AGENT_ACCENT, getAgentAccent } from "../constants/agents";
import type { Message } from "../types";
import { formatTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  messages: Message[];
}

// Detect end: declaration messages — render as system notifications
type EndKind = "done" | "waiting" | null;

function getEndKind(content: string): EndKind {
  if (content.startsWith("end:_done") || content.startsWith("end:failed")) return "done";
  if (content.startsWith("end:waiting")) return "waiting";
  return null;
}

// Strip the end: prefix for display in system notification
function stripEndPrefix(content: string): string {
  const pipeIdx = content.indexOf("|");
  if (pipeIdx !== -1) return content.slice(pipeIdx + 1).trim();
  return content.replace(/^end:[^\s]+\s*/, "").trim();
}

export const MessageFeed = memo(function MessageFeed({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [showJumpButton, setShowJumpButton] = useState(false);

  // Chronological order — oldest first, newest at bottom (chat direction)
  const sorted = [...messages].sort((a, b) => a.created_at - b.created_at);

  // Auto-scroll to bottom on new messages unless user has scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message count change
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledUp = distFromBottom > 80;
    isUserScrollingRef.current = isScrolledUp;
    setShowJumpButton(isScrolledUp);
  }, []);

  const jumpToBottom = useCallback(() => {
    isUserScrollingRef.current = false;
    setShowJumpButton(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div
        ref={containerRef}
        className="overflow-y-auto h-full"
        style={{ padding: "12px 0 16px" }}
        onScroll={handleScroll}
      >
        {sorted.map((msg, idx) => {
          const endKind = getEndKind(msg.content ?? "");
          if (endKind !== null) {
            return (
              <SystemNotification
                key={msg.id}
                message={msg}
                endKind={endKind}
              />
            );
          }
          const prevMsg = idx > 0 ? sorted[idx - 1] : null;
          const isGrouped =
            prevMsg !== null &&
            prevMsg.from_agent === msg.from_agent &&
            getEndKind(prevMsg.content ?? "") === null &&
            msg.created_at - prevMsg.created_at < 60; // group messages within 60s
          return (
            <MessageBubble key={msg.id} message={msg} isGrouped={isGrouped} />
          );
        })}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* Jump to latest button — shown when user has scrolled up */}
      {showJumpButton && (
        <button
          type="button"
          onClick={jumpToBottom}
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid var(--color-border-default)",
            background: "var(--color-surface-raised)",
            color: "var(--color-text-secondary)",
            boxShadow: "var(--shadow-dropdown)",
            zIndex: 10,
            transition: "background 100ms",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-surface-overlay)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-surface-raised)";
          }}
        >
          <span style={{ fontSize: 10 }}>▼</span>
          Latest
        </button>
      )}
    </div>
  );
});

// Chat bubble message — avatar shown only for first in a group
function MessageBubble({ message, isGrouped }: { message: Message; isGrouped: boolean }) {
  const fromColor = getAgentAccent(message.from_agent);
  const toColor = message.to_agent ? getAgentAccent(message.to_agent) : DEFAULT_AGENT_ACCENT;
  const isBroadcast = message.to_agent === null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: isGrouped ? "2px 16px 2px 16px" : "8px 16px 2px 16px",
        // Subtle background tint for DMs
        background: isBroadcast ? "transparent" : `${toColor}06`,
      }}
    >
      {/* Avatar column — 32px wide, avatar or spacer */}
      <div style={{ width: 32, flexShrink: 0, paddingTop: 2 }}>
        {!isGrouped ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              background: `${fromColor}18`,
              border: `1px solid ${fromColor}35`,
              color: fromColor,
              flexShrink: 0,
            }}
          >
            {message.from_agent.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          // Spacer when grouped — timestamp on hover via title
          <div style={{ width: 32, height: 4 }} />
        )}
      </div>

      {/* Bubble content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header — only on first in group */}
        {!isGrouped && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            {/* Sender chip */}
            <span
              className="font-mono"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: fromColor,
              }}
            >
              {message.from_agent}
            </span>

            {/* Direction indicator + recipient */}
            {!isBroadcast && (
              <>
                <span style={{ fontSize: 10, color: "var(--color-text-disabled)", flexShrink: 0 }}>
                  →
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: toColor,
                    background: `${toColor}15`,
                    padding: "1px 5px",
                    borderRadius: 3,
                    flexShrink: 0,
                  }}
                >
                  {message.to_agent}
                </span>
              </>
            )}

            {/* Broadcast badge */}
            {isBroadcast && (
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  color: "var(--color-text-disabled)",
                  background: "var(--color-surface-overlay)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                broadcast
              </span>
            )}

            {/* Timestamp */}
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
        )}

        {/* Message bubble */}
        <div
          style={{
            borderRadius: 8,
            borderLeft: `3px solid ${fromColor}50`,
            background: `${fromColor}08`,
            padding: "7px 10px",
          }}
        >
          <MarkdownContent text={message.content} />
        </div>
      </div>
    </div>
  );
}

// System notification style for end: declarations
function SystemNotification({
  message,
  endKind,
}: {
  message: Message;
  endKind: "done" | "waiting";
}) {
  const fromColor = getAgentAccent(message.from_agent);
  const badgeColor = endKind === "done" ? "#818cf8" : "#fbbf24";
  const bodyText = stripEndPrefix(message.content ?? "");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 16px",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: 9999,
          border: `1px solid ${badgeColor}30`,
          background: `${badgeColor}0c`,
        }}
      >
        {/* Agent chip */}
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: fromColor,
            background: `${fromColor}18`,
            padding: "1px 5px",
            borderRadius: 3,
          }}
        >
          {message.from_agent}
        </span>

        {/* Status badge */}
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: badgeColor,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {endKind}
        </span>

        {/* Body text — trimmed */}
        {bodyText && (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 240,
            }}
          >
            {bodyText}
          </span>
        )}

        {/* Timestamp */}
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: "var(--color-text-disabled)",
            flexShrink: 0,
          }}
        >
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
