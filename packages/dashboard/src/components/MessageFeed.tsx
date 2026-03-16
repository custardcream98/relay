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
import { cn } from "../lib/cn";
import type { Message } from "../types";
import { relativeTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";
import { AgentAvatar } from "./shared/AgentAvatar";
import { AgentChip } from "./shared/AgentChip";

interface Props {
  messages: Message[];
}

// Threads with more messages than this threshold are collapsed by default
const COLLAPSE_THRESHOLD = 3;

// Copy-to-clipboard button — shown on message hover
function CopyButton({ text }: { text: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(
        () => {
          setCopyState("copied");
          if (timerRef.current !== null) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setCopyState("idle");
            timerRef.current = null;
          }, 1500);
        },
        () => {
          // Clipboard access denied (HTTP context, permissions, or focus loss)
          setCopyState("error");
          if (timerRef.current !== null) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setCopyState("idle");
            timerRef.current = null;
          }, 1500);
        }
      );
    },
    [text]
  );

  const label =
    copyState === "copied" ? "Copied!" : copyState === "error" ? "Failed" : "Copy message";

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center w-[22px] h-[22px] rounded p-0 border-none cursor-pointer shrink-0 text-[11px] transition-[background,color] duration-100",
        copyState === "copied"
          ? "bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]"
          : copyState === "error"
            ? "bg-[var(--color-surface-overlay)] text-[var(--color-connection-dead)]"
            : "bg-transparent text-[var(--color-text-disabled)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {copyState === "copied" ? "✓" : copyState === "error" ? "✗" : "⎘"}
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
      className="font-mono text-[10px] text-[var(--color-text-disabled)] cursor-default shrink-0"
      title={full}
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
  const [focused, setFocused] = useState(false);

  // Dynamic border/background from runtime color requires inline style
  const containerStyle = useMemo(
    () => ({
      borderLeft: isDirect && toColor ? `2px solid ${toColor}` : "2px solid transparent",
      background: isDirect && toColor ? `${toColor}06` : "transparent",
    }),
    [isDirect, toColor]
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus interaction for copy button visibility
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      className="flex gap-[10px] px-4 py-[10px] border-b border-[var(--color-border-subtle)] transition-[background] duration-[80ms] relative"
      style={containerStyle}
    >
      <AgentAvatar agentId={msg.from_agent} size={30} />

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-1.5 mb-1">
          <AgentChip agentId={msg.from_agent} />

          {isDirect && msg.to_agent ? (
            <>
              <span className="text-[10px] text-[var(--color-text-disabled)]">→</span>
              <AgentChip agentId={msg.to_agent} />
            </>
          ) : (
            <span className="font-mono text-[10px] text-[var(--color-text-disabled)] bg-[var(--color-surface-overlay)] px-[5px] py-[1px] rounded-[3px]">
              broadcast
            </span>
          )}

          {/* Timestamp — pushed to right */}
          <div className="ml-auto flex items-center gap-1">
            {/* Copy button — visible on hover or when row has keyboard focus */}
            <div
              className="transition-opacity duration-100"
              style={{
                opacity: hovered || focused ? 1 : 0,
                pointerEvents: hovered || focused ? "auto" : "none",
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
  const isThread = msgs.length > 1;
  const [expanded, setExpanded] = useState(false);

  const visibleMsgs =
    isThread && msgs.length > COLLAPSE_THRESHOLD && !expanded
      ? [msgs[0], ...msgs.slice(-(COLLAPSE_THRESHOLD - 1))]
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
          className="flex items-center gap-1.5 w-full px-4 py-[5px] border-b border-[var(--color-border-subtle)] bg-transparent border-t-0 border-l-0 border-r-0 cursor-pointer text-left text-[11px] text-[var(--color-text-disabled)] font-mono transition-colors duration-100 hover:text-[var(--color-text-secondary)]"
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
            <span className="ml-auto text-[9px] opacity-50">#{threadId.slice(0, 8)}</span>
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
  const prevMessageLengthRef = useRef(messages.length);
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
      const key = msg.thread_id ?? `standalone-${msg.id}`;
      if (!threadMap.has(key)) {
        threadMap.set(key, []);
        order.push(key);
      }
      threadMap.get(key)?.push(msg);
    }

    return order.map((key) => ({
      key,
      threadId: !key.startsWith("standalone-") ? key : null,
      msgs: threadMap.get(key) ?? [],
    }));
  }, [filtered]);

  // Auto-scroll to bottom on new messages, unless user scrolled up
  useEffect(() => {
    const delta = messages.length - prevMessageLengthRef.current;
    prevMessageLengthRef.current = messages.length;
    // delta <= 0 means messages were cleared (server switch / new session) — reset badge
    if (delta <= 0) {
      setUnreadCount(0);
      return;
    }
    if (!isUserScrollingRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    } else {
      setUnreadCount((prev) => prev + delta);
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
      <div className="flex items-center gap-2 px-3 py-[5px] border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] shrink-0">
        <input
          type="search"
          placeholder="Filter by agent…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter messages by agent name"
          className="flex-1 h-6 px-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] text-[var(--color-text-primary)] text-[11px] font-mono outline-none min-w-0 transition-[border-color] duration-100 focus:border-[var(--color-border-default)]"
        />

        {/* Message count badge */}
        <span className="font-mono text-[10px] bg-[var(--color-surface-overlay)] text-[var(--color-text-tertiary)] px-1.5 py-[1px] rounded-full shrink-0">
          {filtered.length}
        </span>
      </div>

      {/* Empty state */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-[10px]">
          <span className="text-[28px] opacity-20">💬</span>
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
            {searchQuery ? "No messages match filter" : "No messages yet"}
          </span>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {searchQuery
              ? "Try a different agent name"
              : "Messages will appear when agents communicate"}
          </span>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 overflow-y-auto relative" onScroll={handleScroll}>
          {groups.map((group) => (
            <ThreadGroup key={group.key} threadId={group.threadId} msgs={group.msgs} />
          ))}

          <div ref={bottomRef} className="h-px" />

          {/* Unread count + scroll-to-bottom button */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label={`${unreadCount} new message${unreadCount !== 1 ? "s" : ""} — scroll to bottom`}
              className="sticky bottom-[10px] flex items-center gap-1.5 ml-auto mr-4 text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-surface-overlay)] border border-[var(--color-border-default)] rounded px-[10px] py-[3px] cursor-pointer font-mono shadow-[var(--shadow-card)]"
            >
              <span className="bg-[var(--color-connection-dead)] text-white text-[9px] rounded-full px-[5px] font-bold">
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
