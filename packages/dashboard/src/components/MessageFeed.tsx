// packages/dashboard/src/components/MessageFeed.tsx
// Standalone message feed panel — displays all inter-agent messages with UX enhancements:
// - Sender avatar (first letter of agent_id, deterministic accent color)
// - DM vs broadcast visual distinction (DMs show recipient badge + left accent bar)
// - Thread collapsing (threads with >3 messages are collapsible)
// - Unread message count badge when scrolled up
// - Copy-to-clipboard button on hover for message content
// - Timestamp: relative time by default, full datetime on hover (title tooltip)
// - Search/filter by agent name (in-memory, no API call)

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import type { Message } from "../types";
import { relativeTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  messages: Message[];
}

// Agent avatar — circular chip with accent color and first 2 chars of agent_id
function AgentAvatar({ agentId, size = 28 }: { agentId: string; size?: number }) {
  const color = getAgentAccent(agentId);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
        letterSpacing: "-0.02em",
        userSelect: "none",
      }}
    >
      {agentId.slice(0, 2).toUpperCase()}
    </div>
  );
}

// Agent name chip — colored mono text
function AgentChip({ agentId }: { agentId: string }) {
  const color = getAgentAccent(agentId);
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}18`,
        padding: "1px 5px",
        borderRadius: 3,
        flexShrink: 0,
      }}
    >
      {agentId}
    </span>
  );
}

// Copy-to-clipboard button — shown on message hover
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [text]
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy message"}
      aria-label={copied ? "Copied!" : "Copy message"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 4,
        border: "none",
        background: copied ? "var(--color-surface-overlay)" : "transparent",
        color: copied ? "var(--color-text-secondary)" : "var(--color-text-disabled)",
        cursor: "pointer",
        flexShrink: 0,
        fontSize: 11,
        transition: "background 100ms, color 100ms",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!copied) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-overlay)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-disabled)";
        }
      }}
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}

// Timestamp — relative time by default, full ISO datetime on hover via title attribute
function Timestamp({ createdAtSecs }: { createdAtSecs: number }) {
  const ms = createdAtSecs * 1000;
  const full = new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <span
      className="font-mono"
      title={full}
      style={{
        fontSize: 10,
        color: "var(--color-text-disabled)",
        cursor: "default",
        flexShrink: 0,
      }}
    >
      {relativeTime(ms)}
    </span>
  );
}

// Single message row
const MessageRow = memo(function MessageRow({ msg }: { msg: Message }) {
  const isDirect = msg.to_agent !== null;
  const toColor = isDirect && msg.to_agent ? getAgentAccent(msg.to_agent) : null;
  const [hovered, setHovered] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only interaction for copy button visibility
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        // DMs: left accent bar + subtle tinted background
        borderLeft: isDirect && toColor ? `2px solid ${toColor}` : "2px solid transparent",
        background: isDirect && toColor ? `${toColor}06` : "transparent",
        transition: "background 80ms",
        position: "relative",
      }}
    >
      <AgentAvatar agentId={msg.from_agent} size={30} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <AgentChip agentId={msg.from_agent} />

          {isDirect && msg.to_agent ? (
            // DM: show arrow + recipient chip
            <>
              <span style={{ fontSize: 10, color: "var(--color-text-disabled)" }}>→</span>
              <AgentChip agentId={msg.to_agent} />
            </>
          ) : (
            // Broadcast: subtle label
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: "var(--color-text-disabled)",
                background: "var(--color-surface-overlay)",
                padding: "1px 5px",
                borderRadius: 3,
              }}
            >
              broadcast
            </span>
          )}

          {/* Timestamp — pushed to right */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            {/* Copy button — only visible on hover */}
            <div
              style={{
                opacity: hovered ? 1 : 0,
                transition: "opacity 100ms",
                pointerEvents: hovered ? "auto" : "none",
              }}
            >
              <CopyButton text={msg.content} />
            </div>
            <Timestamp createdAtSecs={msg.created_at} />
          </div>
        </div>

        {/* Message content */}
        <MarkdownContent text={msg.content} />
      </div>
    </div>
  );
});

// Thread group — messages sharing the same thread_id (or a single standalone message)
const ThreadGroup = memo(function ThreadGroup({
  msgs,
  threadId,
}: {
  msgs: Message[];
  threadId: string | null;
}) {
  const COLLAPSE_THRESHOLD = 3;
  const isThread = msgs.length > 1;
  const [expanded, setExpanded] = useState(false);

  const visibleMsgs =
    isThread && msgs.length > COLLAPSE_THRESHOLD && !expanded
      ? // Show first + last when collapsed, hide middle
        [msgs[0], ...msgs.slice(-(COLLAPSE_THRESHOLD - 1))]
      : msgs;

  const hiddenCount =
    isThread && msgs.length > COLLAPSE_THRESHOLD && !expanded
      ? msgs.length - COLLAPSE_THRESHOLD
      : 0;

  return (
    <div>
      {visibleMsgs.map((msg) => (
        <MessageRow key={msg.id} msg={msg} />
      ))}

      {/* Collapse/expand toggle for long threads */}
      {isThread && msgs.length > COLLAPSE_THRESHOLD && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "5px 16px",
            borderBottom: "1px solid var(--color-border-subtle)",
            background: "transparent",
            border: "none",
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: "var(--color-border-subtle)",
            cursor: "pointer",
            textAlign: "left",
            fontSize: 11,
            color: "var(--color-text-disabled)",
            fontFamily: "var(--font-mono)",
            transition: "color 100ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-disabled)";
          }}
        >
          {expanded ? (
            <>
              <span>▲</span>
              <span>Collapse thread</span>
            </>
          ) : (
            <>
              <span>▼</span>
              <span>
                {hiddenCount} more message{hiddenCount !== 1 ? "s" : ""} in thread
              </span>
            </>
          )}
          {threadId && (
            <span style={{ marginLeft: "auto", fontSize: 9, opacity: 0.5 }}>
              #{threadId.slice(0, 8)}
            </span>
          )}
        </button>
      )}
    </div>
  );
});

export const MessageFeed = memo(function MessageFeed({ messages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh relative timestamps every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Filter messages by search query (agent name match)
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.trim().toLowerCase();
    return messages.filter(
      (m) => m.from_agent.toLowerCase().includes(q) || (m.to_agent ?? "").toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Group messages by thread_id — messages without a thread_id get a unique standalone key
  const groups = useMemo(() => {
    const threadMap = new Map<string, Message[]>();
    const order: string[] = [];

    for (const msg of [...filtered].reverse()) {
      // Messages come newest-first from store; reverse to chronological for display
      const key = msg.thread_id ?? `standalone-${msg.id}`;
      if (!threadMap.has(key)) {
        threadMap.set(key, []);
        order.push(key);
      }
      threadMap.get(key)?.push(msg);
    }

    return order.map((key) => ({
      key,
      // null for standalone messages (not part of a named thread)
      threadId: !key.startsWith("standalone-") ? key : null,
      msgs: threadMap.get(key) ?? [],
    }));
  }, [filtered]);

  // Auto-scroll to bottom on new messages, unless user scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message count change
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    } else {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distFromBottom > 80;
    isUserScrollingRef.current = scrolledUp;
    if (!scrolledUp) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    isUserScrollingRef.current = false;
    setUnreadCount(0);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar + unread badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          flexShrink: 0,
        }}
      >
        <input
          type="search"
          placeholder="Filter by agent…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter messages by agent name"
          style={{
            flex: 1,
            height: 24,
            padding: "0 8px",
            borderRadius: 4,
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-surface-inset)",
            color: "var(--color-text-primary)",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            outline: "none",
            minWidth: 0,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--color-border-default)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--color-border-subtle)";
          }}
        />

        {/* Message count badge */}
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            background: "var(--color-surface-overlay)",
            color: "var(--color-text-tertiary)",
            padding: "1px 6px",
            borderRadius: 9999,
            flexShrink: 0,
          }}
        >
          {filtered.length}
        </span>
      </div>

      {/* Empty state */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1" style={{ gap: 10 }}>
          <span style={{ fontSize: 28, opacity: 0.2 }}>💬</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
            {searchQuery ? "No messages match filter" : "No messages yet"}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {searchQuery
              ? "Try a different agent name"
              : "Messages will appear when agents communicate"}
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
          style={{ position: "relative" }}
        >
          {groups.map((group) => (
            <ThreadGroup key={group.key} threadId={group.threadId} msgs={group.msgs} />
          ))}

          <div ref={bottomRef} style={{ height: 1 }} />

          {/* Unread count + scroll-to-bottom button */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label={`${unreadCount} new message${unreadCount !== 1 ? "s" : ""} — scroll to bottom`}
              style={{
                position: "sticky",
                bottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginLeft: "auto",
                marginRight: 16,
                fontSize: 10,
                color: "var(--color-text-secondary)",
                background: "var(--color-surface-overlay)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
                padding: "3px 10px",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 9,
                  borderRadius: 9999,
                  padding: "0 5px",
                  fontWeight: 700,
                }}
              >
                {unreadCount}
              </span>
              ↓ new
            </button>
          )}
        </div>
      )}
    </div>
  );
});
