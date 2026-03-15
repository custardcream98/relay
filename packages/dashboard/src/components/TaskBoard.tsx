// packages/dashboard/src/components/TaskBoard.tsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAgentAccent } from "../constants/agents";
import type { Task } from "../types";
import { MarkdownContent } from "./MarkdownContent";

const COLUMNS = ["todo", "in_progress", "in_review", "done"] as const;
const COLUMN_LABELS: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

// Top accent bar color per column (excluding todo)
const COLUMN_ACCENT: Record<string, string | undefined> = {
  todo: undefined,
  in_progress: "rgba(96,165,250,0.5)",
  in_review: "rgba(251,191,36,0.5)",
  done: "rgba(52,211,153,0.5)",
};

// Left accent bar color per priority
const PRIORITY_BAR_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "transparent",
};

// Status badge color for the detail modal (color-coded per status)
const STATUS_BADGE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  todo: {
    bg: "var(--color-surface-overlay)",
    text: "var(--color-text-tertiary)",
    border: "var(--color-border-subtle)",
  },
  in_progress: {
    bg: "rgba(96,165,250,0.12)",
    text: "#60a5fa",
    border: "rgba(96,165,250,0.4)",
  },
  in_review: {
    bg: "rgba(251,191,36,0.12)",
    text: "#fbbf24",
    border: "rgba(251,191,36,0.4)",
  },
  done: {
    bg: "rgba(52,211,153,0.12)",
    text: "#34d399",
    border: "rgba(52,211,153,0.4)",
  },
};

// Priority label color for the detail modal badge
const PRIORITY_BADGE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", border: "rgba(239,68,68,0.4)" },
  high: { bg: "rgba(249,115,22,0.12)", text: "#f97316", border: "rgba(249,115,22,0.4)" },
  medium: { bg: "rgba(234,179,8,0.12)", text: "#eab308", border: "rgba(234,179,8,0.4)" },
  low: {
    bg: "var(--color-surface-overlay)",
    text: "var(--color-text-tertiary)",
    border: "var(--color-border-subtle)",
  },
};

// Task detail modal — shows full title, description, and metadata
function TaskDetailModal({
  task,
  onClose,
  anchorRect,
}: {
  task: Task;
  onClose: () => void;
  anchorRect: DOMRect | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const accentHex = task.assignee ? getAgentAccent(task.assignee) : null;
  const priorityColors = PRIORITY_BADGE_COLOR[task.priority] ?? PRIORITY_BADGE_COLOR.low;
  const statusColors = STATUS_BADGE_COLOR[task.status] ?? STATUS_BADGE_COLOR.todo;

  // Close on Escape or outside click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    // Use capture so the click registers before React synthetic events
    document.addEventListener("mousedown", handleClick, true);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick, true);
    };
  }, [onClose]);

  // Position the popover below the anchor card if possible; otherwise above
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    width: 320,
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 8,
    boxShadow: "var(--shadow-modal)",
    zIndex: 200,
    padding: 16,
  };

  if (anchorRect) {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const popoverHeight = 300; // estimated
    if (spaceBelow > popoverHeight || spaceBelow > window.innerHeight / 2) {
      popoverStyle.top = anchorRect.bottom + 6;
    } else {
      popoverStyle.bottom = window.innerHeight - anchorRect.top + 6;
    }
    // Horizontal: align to left of anchor, clamped to viewport
    const left = Math.min(anchorRect.left, window.innerWidth - 328);
    popoverStyle.left = Math.max(8, left);
  } else {
    // Fallback: centered
    popoverStyle.top = "50%";
    popoverStyle.left = "50%";
    popoverStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div
      ref={modalRef}
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      {/* Header row — title + close */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.45,
            color: "var(--color-text-primary)",
          }}
        >
          {task.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: "var(--color-text-disabled)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-disabled)";
          }}
        >
          ×
        </button>
      </div>

      {/* Meta chips row */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Priority badge */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 9999,
            background: priorityColors.bg,
            color: priorityColors.text,
            border: `1px solid ${priorityColors.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {task.priority}
        </span>

        {/* Status badge — color-coded: todo=surface, in_progress=blue, in_review=amber, done=green */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            padding: "2px 7px",
            borderRadius: 9999,
            background: statusColors.bg,
            color: statusColors.text,
            border: `1px solid ${statusColors.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {task.status.replace(/_/g, " ")}
        </span>

        {/* Assignee chip */}
        {task.assignee && accentHex && (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 7px",
              borderRadius: 9999,
              color: accentHex,
              background: `${accentHex}1a`,
              border: `1px solid ${accentHex}40`,
            }}
          >
            {task.assignee}
          </span>
        )}
      </div>

      {/* Full description — rendered as markdown */}
      {task.description ? (
        <div
          style={{
            background: "var(--color-surface-inset)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 6,
            padding: "10px 12px",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          <MarkdownContent text={task.description} />
        </div>
      ) : (
        <p
          style={{
            fontSize: 12,
            color: "var(--color-text-disabled)",
            fontStyle: "italic",
          }}
        >
          No description provided.
        </p>
      )}

      {/* Timestamps */}
      {(task.created_at || task.updated_at) && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {task.created_at && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
              }}
            >
              created {new Date(task.created_at * 1000).toLocaleString()}
            </span>
          )}
          {task.updated_at && task.updated_at !== task.created_at && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-disabled)",
              }}
            >
              updated {new Date(task.updated_at * 1000).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const TaskBoard = memo(function TaskBoard({ tasks }: { tasks: Task[] }) {
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const task of tasks) {
      if (!grouped[task.status]) grouped[task.status] = [];
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  // Task detail popover state
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleCardClick = useCallback((task: Task, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setDetailTask((prev) => (prev?.id === task.id ? null : task));
    setAnchorRect(rect);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailTask(null);
    setAnchorRect(null);
  }, []);

  return (
    <>
      <div className="flex h-full" style={{ borderRight: "none" }}>
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col] ?? [];
          const accentColor = COLUMN_ACCENT[col];

          return (
            <div
              key={col}
              className="flex-1 min-w-0 flex flex-col overflow-hidden"
              style={{ borderRight: "1px solid var(--color-border-subtle)" }}
            >
              {/* Column header — 36px, includes top accent bar */}
              <div
                style={{
                  height: 36,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                  borderBottom: "1px solid var(--color-border-subtle)",
                  // in_progress/in_review/done: top 2px accent bar
                  borderTop: accentColor ? `2px solid ${accentColor}` : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {COLUMN_LABELS[col]}
                </span>
                {/* Count badge — always visible (including 0) */}
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    background: "var(--color-surface-overlay)",
                    color: "var(--color-text-secondary)",
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 8, gap: 4 }}>
                {colTasks.length === 0 ? (
                  // Empty column state
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "16px 8px",
                      opacity: 0.45,
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                      style={{ color: "var(--color-text-disabled)" }}
                    >
                      <rect
                        x="3"
                        y="3"
                        width="14"
                        height="14"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                    </svg>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-disabled)",
                        textAlign: "center",
                        lineHeight: 1.4,
                      }}
                    >
                      No tasks yet
                    </span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const isDone = col === "done";
                    const priorityBarColor = PRIORITY_BAR_COLOR[task.priority] ?? "transparent";
                    const accentHex = task.assignee ? getAgentAccent(task.assignee) : null;
                    const showPriorityLabel =
                      task.priority === "critical" || task.priority === "high";
                    const isSelected = detailTask?.id === task.id;

                    return (
                      <button
                        type="button"
                        key={task.id}
                        aria-label={`Task: ${task.title}. Click to view details.`}
                        aria-expanded={isSelected}
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          // left padding: space for priority bar
                          padding: "8px 10px 8px 14px",
                          background: isSelected
                            ? "var(--color-surface-overlay)"
                            : "var(--color-surface-raised)",
                          border: isSelected
                            ? "1px solid var(--color-border-default)"
                            : "1px solid var(--color-border-subtle)",
                          borderRadius: 6,
                          boxShadow: isSelected ? "var(--shadow-card-hover)" : "var(--shadow-card)",
                          // done cards: reduced opacity
                          opacity: isDone ? 0.45 : 1,
                          transition: "background 100ms, border-color 100ms, box-shadow 100ms",
                          cursor: "pointer",
                          // prevent card from being flattened in flex container
                          flexShrink: 0,
                          // reset button defaults
                          width: "100%",
                          textAlign: "left",
                          font: "inherit",
                          color: "inherit",
                        }}
                        onClick={(e) =>
                          handleCardClick(task, e as unknown as React.MouseEvent<HTMLDivElement>)
                        }
                        onMouseEnter={(e) => {
                          if (isSelected) return;
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = "var(--color-surface-overlay)";
                          el.style.borderColor = "var(--color-border-default)";
                          el.style.boxShadow = "var(--shadow-card-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (isSelected) return;
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = "var(--color-surface-raised)";
                          el.style.borderColor = "var(--color-border-subtle)";
                          el.style.boxShadow = "var(--shadow-card)";
                        }}
                      >
                        {/* Left priority accent bar */}
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 4,
                            bottom: 4,
                            width: 2,
                            borderRadius: 1,
                            background: priorityBarColor,
                          }}
                        />

                        {/* Task title */}
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 400,
                            lineHeight: 1.45,
                            color: isDone
                              ? "var(--color-text-tertiary)"
                              : "var(--color-text-primary)",
                            textDecoration: isDone ? "line-through" : undefined,
                            display: "block",
                          }}
                        >
                          {task.title}
                        </span>

                        {/* Description preview — 2-line clamp */}
                        {task.description && (
                          <p
                            style={{
                              fontSize: 11,
                              lineHeight: 1.5,
                              color: "var(--color-text-tertiary)",
                              margin: "4px 0 0",
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              wordBreak: "break-word",
                            }}
                          >
                            {task.description}
                          </p>
                        )}

                        {/* Meta row — assignee chip + priority label */}
                        {(task.assignee || showPriorityLabel) && (
                          <div
                            style={{
                              marginTop: 6,
                              display: "flex",
                              flexDirection: "row",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            {/* Assignee chip */}
                            {task.assignee && accentHex && (
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  color: accentHex,
                                  background: `${accentHex}1a`,
                                }}
                              >
                                {task.assignee}
                              </span>
                            )}
                            {/* critical/high priority label */}
                            {showPriorityLabel && (
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 11,
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                {task.priority}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail popover — rendered outside the board to avoid overflow clipping */}
      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={handleCloseDetail} anchorRect={anchorRect} />
      )}
    </>
  );
});
