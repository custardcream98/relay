// packages/dashboard/src/components/AgentDetailPanel.tsx
// Agent detail panel that replaces TaskBoard in Focus Mode
// Tabs: Thoughts | Messages | Tasks
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_AGENT_ACCENT, getAgentAccent } from "../constants/agents";
import { STATUS_HEX_COLORS, STATUS_HEX_FALLBACK } from "../constants/status";
import { cn } from "../lib/cn";
import type { AgentId, Message, Task } from "../types";
import { formatTime } from "../utils/time";
import { MarkdownContent } from "./MarkdownContent";

interface Props {
  agentId: AgentId;
  status: "idle" | "working" | "waiting" | "done";
  thinkingChunk: string;
  messages: Message[];
  tasks: Task[];
}

type Tab = "thoughts" | "messages" | "tasks";

export function AgentDetailPanel({ agentId, status, thinkingChunk, messages, tasks }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("thoughts");
  const accentColor = getAgentAccent(agentId);

  // Memoized filters — avoids creating new arrays on every render (e.g. thinkingChunk updates)
  const agentMessages = useMemo(
    () => messages.filter((m) => m.from_agent === agentId || m.to_agent === agentId),
    [messages, agentId]
  );
  const agentTasks = useMemo(() => tasks.filter((t) => t.assignee === agentId), [tasks, agentId]);

  // Stable tab definitions — only recalculate when counts change
  const TABS = useMemo<{ id: Tab; label: string; count?: number }[]>(
    () => [
      { id: "thoughts", label: "Thoughts" },
      { id: "messages", label: "Messages", count: agentMessages.length },
      { id: "tasks", label: "Tasks", count: agentTasks.length },
    ],
    [agentMessages.length, agentTasks.length]
  );

  return (
    <div className="flex h-full flex-col bg-(--color-surface-inset)">
      {/* Tab header */}
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-(--color-border-subtle) bg-(--color-surface-base) px-3">
        {/* Agent name */}
        <span className="mr-3 shrink-0 text-xs font-semibold" style={{ color: accentColor }}>
          {agentId}
        </span>

        {/* Tab buttons */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border-none px-[10px] py-1 text-[11px] font-medium transition-[background,color] duration-100"
            style={{
              background: activeTab === tab.id ? `${accentColor}20` : "transparent",
              color: activeTab === tab.id ? accentColor : "var(--color-text-tertiary)",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="rounded-[3px] px-1 font-mono text-[9px]"
                style={{
                  background:
                    activeTab === tab.id ? `${accentColor}30` : "var(--color-surface-overlay)",
                  color: activeTab === tab.id ? accentColor : "var(--color-text-disabled)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "thoughts" && (
          <ThoughtsTab status={status} chunk={thinkingChunk} accentColor={accentColor} />
        )}
        {activeTab === "messages" && (
          <MessagesTab messages={agentMessages} agentId={agentId} accentColor={accentColor} />
        )}
        {activeTab === "tasks" && <TasksTab tasks={agentTasks} />}
      </div>
    </div>
  );
}

// Thoughts tab
function ThoughtsTab({
  status,
  chunk,
  accentColor,
}: {
  status: string;
  chunk: string;
  accentColor: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Track scroll state via ref — prevents stale closure
  const userScrolledUpRef = useRef(false);
  // Only button visibility as state (re-render trigger)
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunk]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
    userScrolledUpRef.current = scrolledUp;
    setShowScrollBtn(scrolledUp);
  }, []);

  if (!chunk) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <span className="text-2xl opacity-30">🧠</span>
        <span className="text-xs text-(--color-text-tertiary)">
          {status === "idle" ? "Agent is idle" : "Waiting for reasoning…"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-auto px-4 py-3 font-mono text-[11px] leading-[1.7] text-(--color-text-secondary)"
    >
      {chunk}
      {/* Cursor */}
      <span
        className="ml-[2px] inline-block h-[13px] w-1.5 align-text-bottom"
        style={{
          background: status === "working" ? accentColor : "var(--color-text-disabled)",
          animation: status === "working" ? "blink 1.2s step-end infinite" : "none",
        }}
      />
      <div ref={bottomRef} />
      {showScrollBtn && (
        <button
          type="button"
          onClick={() => {
            userScrolledUpRef.current = false;
            setShowScrollBtn(false);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="sticky bottom-2 ml-auto block cursor-pointer rounded border border-(--color-border-default) bg-(--color-surface-overlay) px-2 py-[3px] font-mono text-[10px] text-(--color-text-secondary)"
        >
          ↓ latest
        </button>
      )}
    </div>
  );
}

// Messages tab
function MessagesTab({
  messages,
  agentId,
  accentColor,
}: {
  messages: Message[];
  agentId: string;
  accentColor: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <span className="text-2xl opacity-30">💬</span>
        <span className="text-xs text-(--color-text-tertiary)">No messages yet</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {messages.map((msg) => {
        const isSent = msg.from_agent === agentId;
        const otherAgent = isSent ? msg.to_agent : msg.from_agent;
        const otherColor = otherAgent ? getAgentAccent(otherAgent) : DEFAULT_AGENT_ACCENT;

        return (
          <div
            key={msg.id}
            className="flex flex-row gap-2 border-b border-(--color-border-subtle) px-[14px] py-[10px]"
          >
            {/* Direction indicator */}
            <span
              className="shrink-0 pt-px text-sm"
              style={{ color: isSent ? accentColor : otherColor }}
            >
              {isSent ? "↑" : "↓"}
            </span>

            <div className="min-w-0 flex-1">
              {/* Header */}
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: isSent ? accentColor : otherColor }}
                >
                  {isSent ? "→" : "←"} {otherAgent ?? "broadcast"}
                </span>
                <span className="ml-auto font-mono text-[10px] text-(--color-text-disabled)">
                  {formatTime(msg.created_at)}
                </span>
              </div>
              <MarkdownContent text={msg.content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tasks tab
function TasksTab({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <span className="text-2xl opacity-30">✅</span>
        <span className="text-xs text-(--color-text-tertiary)">No tasks assigned</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      {tasks.map((task) => {
        const isDone = task.status === "done";
        // Use hex fallback (not a CSS var) so appending "18" for alpha is always valid CSS
        const statusColor = STATUS_HEX_COLORS[task.status] ?? STATUS_HEX_FALLBACK;

        return (
          <div
            key={task.id}
            className={cn(
              "mb-1.5 rounded-[6px] border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-[10px]",
              isDone && "opacity-50"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="shrink-0 rounded-[3px] px-[5px] py-px font-mono text-[9px] tracking-[0.05em] uppercase"
                style={{ color: statusColor, background: `${statusColor}18` }}
              >
                {task.status.replaceAll("_", " ")}
              </span>
              <span
                className={cn(
                  "flex-1 overflow-hidden text-xs text-ellipsis whitespace-nowrap",
                  isDone
                    ? "text-(--color-text-tertiary) line-through"
                    : "text-(--color-text-primary)"
                )}
                style={{ fontWeight: 450 }}
              >
                {task.title}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
