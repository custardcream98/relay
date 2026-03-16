// packages/dashboard/src/components/AgentDetailPanel.tsx
// Agent detail panel that replaces TaskBoard in Focus Mode
// Tabs: Thoughts | Messages | Tasks

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_AGENT_ACCENT, getAgentAccent } from "../constants/agents";
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

// Status colors — hex values only so that alpha suffix (e.g. `${COLOR}18`) is valid CSS.
// All values must be hex strings; CSS vars cannot be used here because appending "18"
// to a CSS var produces invalid CSS like `var(--foo)18`.
const STATUS_COLOR: Record<string, string> = {
  todo: "#6b7280",
  in_progress: "#60a5fa",
  in_review: "#fbbf24",
  done: "#818cf8",
};
// Fallback hex used when task.status is not in STATUS_COLOR
const STATUS_COLOR_FALLBACK = "#6b7280";

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
    <div className="flex flex-col h-full bg-[var(--color-surface-inset)]">
      {/* Tab header */}
      <div className="flex items-center shrink-0 h-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] px-3 gap-0.5">
        {/* Agent name */}
        <span className="text-xs font-semibold mr-3 shrink-0" style={{ color: accentColor }}>
          {agentId}
        </span>

        {/* Tab buttons */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-[5px] px-[10px] py-1 rounded-[5px] text-[11px] font-medium cursor-pointer border-none transition-[background,color] duration-100"
            style={{
              background: activeTab === tab.id ? `${accentColor}20` : "transparent",
              color: activeTab === tab.id ? accentColor : "var(--color-text-tertiary)",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="font-mono text-[9px] px-1 rounded-[3px]"
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: chunk triggers scroll but isn't read inside
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
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl opacity-30">🧠</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {status === "idle" ? "Agent is idle" : "Waiting for reasoning…"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="font-mono h-full overflow-auto px-4 py-3 text-[11px] leading-[1.7] text-[var(--color-text-secondary)]"
    >
      {chunk}
      {/* Cursor */}
      <span
        className="inline-block w-1.5 h-[13px] ml-[2px] align-text-bottom"
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
          className="sticky bottom-2 block ml-auto text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-surface-overlay)] border border-[var(--color-border-default)] rounded px-2 py-[3px] cursor-pointer font-mono"
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
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl opacity-30">💬</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">No messages yet</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {messages.map((msg) => {
        const isSent = msg.from_agent === agentId;
        const otherAgent = isSent ? msg.to_agent : msg.from_agent;
        const otherColor = otherAgent ? getAgentAccent(otherAgent) : DEFAULT_AGENT_ACCENT;

        return (
          <div
            key={msg.id}
            className="flex flex-row gap-2 px-[14px] py-[10px] border-b border-[var(--color-border-subtle)]"
          >
            {/* Direction indicator */}
            <span
              className="text-sm shrink-0 pt-[1px]"
              style={{ color: isSent ? accentColor : otherColor }}
            >
              {isSent ? "↑" : "↓"}
            </span>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: isSent ? accentColor : otherColor }}
                >
                  {isSent ? "→" : "←"} {otherAgent ?? "broadcast"}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-text-disabled)] ml-auto">
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
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl opacity-30">✅</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">No tasks assigned</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-3">
      {tasks.map((task) => {
        const isDone = task.status === "done";
        // Use hex fallback (not a CSS var) so appending "18" for alpha is always valid CSS
        const statusColor = STATUS_COLOR[task.status] ?? STATUS_COLOR_FALLBACK;

        return (
          <div
            key={task.id}
            className={cn(
              "px-3 py-[10px] mb-1.5 rounded-[6px] bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)]",
              isDone && "opacity-50"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[9px] px-[5px] py-[1px] rounded-[3px] uppercase tracking-[0.05em] shrink-0"
                style={{ color: statusColor, background: `${statusColor}18` }}
              >
                {task.status.replaceAll("_", " ")}
              </span>
              <span
                className={cn(
                  "text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
                  isDone
                    ? "text-[var(--color-text-tertiary)] line-through"
                    : "text-[var(--color-text-primary)]"
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
