// packages/dashboard/src/components/AgentDetailPanel.tsx
// Focus Mode에서 TaskBoard를 대체하는 에이전트 상세 패널
// 탭: Thoughts | Messages | Tasks

import { useEffect, useRef, useState } from "react";
import { AGENT_ACCENT_HEX } from "../constants/agents";
import type { AgentId } from "../types";
import { MarkdownContent } from "./MarkdownContent";

interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  content: string;
  created_at: number;
}

interface Task {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: string;
}

interface Props {
  agentId: AgentId;
  status: "idle" | "working" | "waiting";
  thinkingChunk: string;
  messages: Message[];
  tasks: Task[];
}

type Tab = "thoughts" | "messages" | "tasks";

// 상태 컬러
const STATUS_COLOR: Record<string, string> = {
  todo: "var(--color-text-disabled)",
  in_progress: "#60a5fa",
  in_review: "#fbbf24",
  done: "var(--color-status-working)",
};

function formatTime(unixSecs: number) {
  return new Date(unixSecs * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AgentDetailPanel({ agentId, status, thinkingChunk, messages, tasks }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("thoughts");
  const accentColor = AGENT_ACCENT_HEX[agentId] ?? "#9898a8";

  // 해당 에이전트의 메시지/태스크 필터
  const agentMessages = messages.filter((m) => m.from_agent === agentId || m.to_agent === agentId);
  const agentTasks = tasks.filter((t) => t.assignee === agentId);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "thoughts", label: "Thoughts" },
    { id: "messages", label: "Messages", count: agentMessages.length },
    { id: "tasks", label: "Tasks", count: agentTasks.length },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-surface-inset)" }}>
      {/* 탭 헤더 */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: 40,
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface-base)",
          paddingLeft: 12,
          paddingRight: 12,
          gap: 2,
        }}
      >
        {/* 에이전트 이름 */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: accentColor,
            marginRight: 12,
            flexShrink: 0,
          }}
        >
          {agentId}
        </span>

        {/* 탭 버튼 */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              background: activeTab === tab.id ? `${accentColor}20` : "transparent",
              color: activeTab === tab.id ? accentColor : "var(--color-text-tertiary)",
              transition: "background 100ms, color 100ms",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  background:
                    activeTab === tab.id ? `${accentColor}30` : "var(--color-surface-overlay)",
                  color: activeTab === tab.id ? accentColor : "var(--color-text-disabled)",
                  padding: "0 4px",
                  borderRadius: 3,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "thoughts" && (
          <ThoughtsTab
            agentId={agentId}
            status={status}
            chunk={thinkingChunk}
            accentColor={accentColor}
          />
        )}
        {activeTab === "messages" && (
          <MessagesTab messages={agentMessages} agentId={agentId} accentColor={accentColor} />
        )}
        {activeTab === "tasks" && <TasksTab tasks={agentTasks} accentColor={accentColor} />}
      </div>
    </div>
  );
}

// Thoughts 탭
function ThoughtsTab({
  status,
  chunk,
  accentColor,
}: {
  agentId: string;
  status: string;
  chunk: string;
  accentColor: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chunk 변경 시 스크롤
  useEffect(() => {
    if (!userScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunk]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setUserScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 60);
  };

  if (!chunk) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 8 }}>
        <span style={{ fontSize: 24, opacity: 0.3 }}>🧠</span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
          {status === "idle" ? "Agent is idle" : "Waiting for reasoning…"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="font-mono h-full overflow-auto"
      style={{
        padding: "12px 16px",
        fontSize: 11,
        lineHeight: 1.7,
        color: "var(--color-text-secondary)",
      }}
    >
      {chunk}
      {/* 커서 */}
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 13,
          background: status === "working" ? accentColor : "var(--color-text-disabled)",
          marginLeft: 2,
          verticalAlign: "text-bottom",
          animation: status !== "working" ? "blink 1.2s step-end infinite" : "none",
        }}
      />
      <div ref={bottomRef} />
      {userScrolledUp && (
        <button
          type="button"
          onClick={() => {
            setUserScrolledUp(false);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          style={{
            position: "sticky",
            bottom: 8,
            display: "block",
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--color-text-secondary)",
            background: "var(--color-surface-overlay)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 4,
            padding: "3px 8px",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
          }}
        >
          ↓ latest
        </button>
      )}
    </div>
  );
}

// Messages 탭
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
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 8 }}>
        <span style={{ fontSize: 24, opacity: 0.3 }}>💬</span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>No messages yet</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {messages.map((msg) => {
        const isSent = msg.from_agent === agentId;
        const otherAgent = isSent ? msg.to_agent : msg.from_agent;
        const otherColor = otherAgent ? (AGENT_ACCENT_HEX[otherAgent] ?? "#9898a8") : "#9898a8";

        return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              padding: "10px 14px",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            {/* 방향 인디케이터 */}
            <span
              style={{
                fontSize: 14,
                flexShrink: 0,
                paddingTop: 1,
                color: isSent ? accentColor : otherColor,
              }}
            >
              {isSent ? "↑" : "↓"}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 헤더 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isSent ? accentColor : otherColor,
                  }}
                >
                  {isSent ? "→" : "←"} {otherAgent ?? "broadcast"}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: "var(--color-text-disabled)", marginLeft: "auto" }}
                >
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

// Tasks 탭
function TasksTab({ tasks }: { tasks: Task[]; accentColor: string }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ gap: 8 }}>
        <span style={{ fontSize: 24, opacity: 0.3 }}>✅</span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>No tasks assigned</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full" style={{ padding: 12 }}>
      {tasks.map((task) => {
        const isDone = task.status === "done";
        const statusColor = STATUS_COLOR[task.status] ?? "var(--color-text-disabled)";

        return (
          <div
            key={task.id}
            style={{
              padding: "10px 12px",
              marginBottom: 6,
              borderRadius: 6,
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
              opacity: isDone ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: statusColor,
                  background: `${statusColor}18`,
                  padding: "1px 5px",
                  borderRadius: 3,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}
              >
                {task.status.replace("_", " ")}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 450,
                  color: isDone ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                  textDecoration: isDone ? "line-through" : undefined,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
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
